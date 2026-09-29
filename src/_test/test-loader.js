// Info: Test host for the app core. Builds Lib through the real loader with
// stub adapters (the test tier is a host, never a second composition root),
// then proves every profile and scheme builds a component system, both brand
// layers reach the tokens, fonts the host lacks fall back to System and are
// reported, the showcase renders every catalog state, and the walker report
// has the shape the native gate reads.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import appLoader from '../app-core/loader.js';
import { LibProvider } from '../app-core/contexts/lib-context.js';
import { buildSystem, THEME_PLATFORM } from '../themes/build-system.js';
import ShowcaseIndex from '../screens/showcase/ShowcaseIndex.js';
import FamilyPage from '../screens/showcase/FamilyPage.js';
import { getFamilies, getHref } from '../screens/showcase/catalog.js';
import { buildReport } from '../screens/walk/report.js';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };
const { Lib } = appLoader(ADAPTERS);


/********************************************************************
Every text node under a test-renderer tree, in order.

@param {Object} node - Renderer JSON node

@return {Array} - Strings
*********************************************************************/
function texts (node) {

  if (node === null || node === undefined) {
    return [];
  }
  if (typeof node === 'string') {
    return [node];
  }
  if (Array.isArray(node)) {
    return node.flatMap(texts);
  }

  return texts(node.children || []);

}


describe('loader', function () {

  test('builds every slot the app and the component library read', function () {
    for (const slot of ['React', 'ReactNative', 'Svg', 'Utils', 'Debug', 'Themer', 'ThemerReact', 'Font', 'Fonts', 'Navigation', 'Themes', 'Components', 'ThemeContext', 'Config']) {
      assert.ok(Lib[slot] !== undefined && Lib[slot] !== null, 'Lib.' + slot + ' is missing');
    }
    assert.deepEqual(Object.keys(Lib.Themes.profiles).sort(), ['carbon', 'default', 'material']);
    assert.equal(typeof Lib.Components.createSystem, 'function');
    assert.equal(typeof Lib.Components.factories.Icon, 'function');
    assert.equal(Lib.Icons, undefined, 'icons are theme tokens, not a host adapter');
  });

  test('a missing adapter slot throws, naming every gap', function () {
    assert.throws(function () {
      appLoader({});
    }, /missing or invalid adapter slots: Navigation, Fonts/);
  });

  test('the theme is built for the native projection', function () {
    assert.equal(THEME_PLATFORM, 'native');
  });

});


describe('build-system: every profile and scheme', function () {

  for (const profileName of ['default', 'carbon', 'material']) {
    const profile = Lib.Themes.profiles[profileName];
    for (const schemeName of Object.keys(profile.schemes)) {
      test(profileName + ' / ' + schemeName + ' builds a registry with every library component', function () {
        const built = Lib.Themer.buildTheme(profile.schemes[schemeName], [], THEME_PLATFORM);
        const result = buildSystem(Lib, built, null, 'md');
        assert.deepEqual(Object.keys(result.Registry).sort(), Object.keys(Lib.Components.factories).sort());
        assert.ok(Object.isFrozen(result.Registry));
      });
    }
  }

  test('fonts the host does not carry fall back to System, are reported, and the built theme is not mutated', function () {
    const built = Lib.Themer.buildTheme(Lib.Themes.profiles.carbon.schemes.white, [], THEME_PLATFORM);
    const sans = built.tokens['font.family.sans'];
    const result = buildSystem(Lib, built, null, 'md');
    assert.equal(result.tokens['font.family.sans'], 'System');
    assert.ok(result.fallbacks.includes('font.family.sans=' + sans));
    assert.equal(built.tokens['font.family.sans'], sans, 'the engine result must not be written into');
  });

  test('the rounded brand layer reaches the tokens without rebuilding the template', function () {
    const template = Lib.Themes.profiles.carbon.schemes.white;
    const plain = Lib.Themer.buildTheme(template, [], THEME_PLATFORM);
    const branded = Lib.Themer.buildTheme(template, [Lib.Themes.brands.rounded], THEME_PLATFORM);
    assert.equal(branded.tokens['shape.radius_00'], 8);
    assert.equal(branded.tokens['feedback.field'], 'outline');
    assert.notEqual(plain.tokens['shape.radius_00'], 8);
  });

});


/********************************************************************
Render an element inside the Lib and theme providers.

@param {Object} element - Screen element
@param {Object} theme   - { profile, scheme, brand }

@return {Promise<Object>} - The test renderer
*********************************************************************/
async function renderThemed (element, theme) {

  let renderer;
  await act(async function () {
    renderer = TestRenderer.create(
      React.createElement(LibProvider, { adapters: ADAPTERS },
        React.createElement(function App () {
          const { ThemeProvider } = Lib.ThemeContext;
          return React.createElement(ThemeProvider, theme, element);
        }))
    );
  });

  return renderer;

}


describe('showcase', function () {

  test('the catalog groups into families in roster order', function () {
    const families = getFamilies(Lib.Components.catalog);
    assert.ok(families.length >= 1);
    assert.equal(families.reduce(function (sum, group) {
      return sum + group.components.length;
    }, 0), Lib.Components.catalog.length);
    assert.deepEqual(Lib.Components.catalog.map(function (entry) {
      return entry.name;
    }).sort(), Object.keys(Lib.Components.factories).sort());
  });

  test('links carry profile, scheme and brand', function () {
    assert.equal(getHref('/showcase/Icon', { profileName: 'carbon', schemeName: 'g10', brandName: 'acme' }), '/showcase/Icon?profile=carbon&scheme=g10&brand=acme');
    assert.equal(getHref('/walk', { profileName: 'default', schemeName: 'light', brandName: null }), '/walk?profile=default&scheme=light');
  });

  for (const profileName of ['default', 'carbon', 'material']) {
    test(profileName + ': the index names the selection and every family', async function () {
      const renderer = await renderThemed(React.createElement(ShowcaseIndex), { profile: profileName });
      const lines = texts(renderer.toJSON());
      const scheme = Object.keys(Lib.Themes.profiles[profileName].schemes)[0];
      assert.ok(lines.includes(profileName + ' / ' + scheme), lines.join(' | '));
      for (const group of getFamilies(Lib.Components.catalog)) {
        assert.ok(lines.includes(group.family + ' (' + group.components.length + ')'), group.family);
      }
      await act(async function () {
        renderer.unmount();
      });
    });

    test(profileName + ': every family page renders one error-free cell per sample state', async function () {
      for (const group of getFamilies(Lib.Components.catalog)) {
        const renderer = await renderThemed(React.createElement(FamilyPage, { family: group.family }), { profile: profileName });
        const expected = group.components.reduce(function (sum, entry) {
          return sum + entry.sample.length;
        }, 0);
        const ids = new Set(renderer.root.findAll(function (node) {
          return typeof node.type === 'string' && node.props['data-cell'] === 'true';
        }).map(function (node) {
          return node.props['data-component'] + '/' + node.props['data-state'];
        }));
        assert.equal(ids.size, expected, group.family + ' cell count');
        assert.equal(renderer.root.findAll(function (node) {
          return typeof node.type === 'string' && node.props['data-testid'] === 'cell-error';
        }).length, 0, group.family + ' has a failing cell');
        await act(async function () {
          renderer.unmount();
        });
      }
    });
  }

  test('an unknown profile is a programmer error', async function () {
    await assert.rejects(async function () {
      await renderThemed(React.createElement(ShowcaseIndex), { profile: 'nope' });
    }, /unknown profile "nope"/);
  });

});


describe('acme brand', function () {

  for (const profileName of ['default', 'carbon', 'material']) {
    test(profileName + ' + acme: color, family, radii and three glyphs reach the built theme', function () {
      const profile = Lib.Themes.profiles[profileName];
      const template = profile.schemes[Object.keys(profile.schemes)[0]];
      const acme = Lib.Themes.brands.acme.tokens;
      const built = Lib.Themer.buildTheme(template, [Lib.Themes.brands.acme], THEME_PLATFORM);
      for (const name of ['color.interactive', 'color.focus', 'font.family.sans', 'shape.radius_04', 'shape.radius_08']) {
        assert.equal(built.tokens[name], acme[name], name);
      }
      for (const name of ['icon.close', 'icon.checkmark', 'icon.search']) {
        assert.deepEqual(built.tokens[name], acme[name], name);
      }
      const result = buildSystem(Lib, built, null, 'md');
      assert.equal(Object.keys(result.Registry).length, Object.keys(Lib.Components.factories).length);
    });
  }

});


describe('walker report', function () {

  test('carries every field the native gate reads, with fonts named and drawn', function () {
    const built = Lib.Themer.buildTheme(Lib.Themes.profiles.material.schemes.light, [Lib.Themes.brands.acme], THEME_PLATFORM);
    const result = buildSystem(Lib, built, null, 'md');
    const ctx = { built: built, theme: result.tokens, profileName: 'material', schemeName: 'light', brandName: 'acme' };
    const report = buildReport({
      ctx: ctx,
      platform: 'ios',
      catalog: Lib.Components.catalog,
      cells: [{ component: 'Icon', state: 'default', width: 20, height: 20 }],
      errors: []
    });
    assert.deepEqual(Object.keys(report).sort(), ['brand', 'cells', 'components', 'errors', 'expectedCells', 'family', 'fonts', 'platform', 'schema', 'scheme', 'theme', 'tokens']);
    assert.equal(report.expectedCells, Lib.Components.catalog.reduce(function (sum, entry) {
      return sum + entry.sample.length;
    }, 0));
    assert.equal(report.tokens['color.interactive'], Lib.Themes.brands.acme.tokens['color.interactive']);
    const sans = report.fonts.find(function (font) {
      return font.role === 'font.family.sans';
    });
    assert.deepEqual(sans, { role: 'font.family.sans', family: 'Roboto', drawn: 'System', loaded: false });
  });

});
