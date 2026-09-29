// Info: Test host for the app core. Builds Lib through the real loader with
// stub adapters (the test tier is a host, never a second composition root),
// then proves every profile and scheme builds a component system, the brand
// layer reaches the tokens, fonts the host lacks fall back to System and are
// reported, and the bootstrap screen renders a library component.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import appLoader from '../app-core/loader.js';
import { LibProvider } from '../app-core/contexts/lib-context.js';
import { buildSystem, THEME_PLATFORM } from '../themes/build-system.js';
import Home from '../screens/home/Home.js';
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


describe('Home under the theme provider', function () {

  for (const profileName of ['default', 'carbon', 'material']) {
    test(profileName + ': renders the profile, the component count and an icon', async function () {
      let renderer;
      await act(async function () {
        renderer = TestRenderer.create(
          React.createElement(LibProvider, { adapters: ADAPTERS },
            React.createElement(function App () {
              const { ThemeProvider } = Lib.ThemeContext;
              return React.createElement(ThemeProvider, { profile: profileName }, React.createElement(Home));
            }))
        );
      });
      const lines = texts(renderer.toJSON());
      const scheme = Object.keys(Lib.Themes.profiles[profileName].schemes)[0];
      assert.ok(lines.includes('Profile: ' + profileName + ' / ' + scheme), lines.join(' | '));
      assert.ok(lines.includes('Components: ' + Object.keys(Lib.Components.factories).length), lines.join(' | '));
      const svg = renderer.root.findAll(function (node) {
        return node.type === 'svg';
      });
      assert.equal(svg.length, 1);
      assert.ok(svg[0].findAll(function (node) {
        return node.type === 'path' && typeof node.props.d === 'string' && node.props.d.length > 0;
      }).length >= 1);
      await act(async function () {
        renderer.unmount();
      });
    });
  }

  test('an unknown profile is a programmer error', async function () {
    await assert.rejects(async function () {
      await act(async function () {
        TestRenderer.create(
          React.createElement(LibProvider, { adapters: ADAPTERS },
            React.createElement(function App () {
              const { ThemeProvider } = Lib.ThemeContext;
              return React.createElement(ThemeProvider, { profile: 'nope' }, React.createElement(Home));
            }))
        );
      });
    }, /unknown profile "nope"/);
  });

});
