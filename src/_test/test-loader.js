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
import Walker from '../screens/walk/Walker.js';
import Autopilot from '../screens/walk/Autopilot.js';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';
import { isAppFocused } from '../../scripts/device-focus.js';

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
          return sum + entry.sample.filter(function (state) {
            return state.cell !== false;
          }).length;
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

  test('a component whose catalog entry names a frame is laid out in it; every other cell body shrinks to its content', async function () {
    for (const entry of Lib.Components.catalog) {
      const renderer = await renderThemed(React.createElement(FamilyPage, { family: entry.family }), { profile: 'carbon' });
      const body = renderer.root.findAll(function (node) {
        return typeof node.type === 'string' && node.props['data-testid'] === 'body-' + entry.name + '-' + entry.sample[0].label;
      })[0];
      assert.deepEqual(body.props.style || null, entry.frame ? Object.assign(
        {},
        entry.frame.height !== undefined ? { height: entry.frame.height + 'px' } : null,
        entry.frame.stage === true ? { transform: 'translateX(0px)' } : null,
        { width: entry.frame.width + 'px' }
      ) : null, entry.name);
      await act(async function () {
        renderer.unmount();
      });
    }
    assert.ok(Lib.Components.catalog.some(function (entry) {
      return entry.frame !== null;
    }), 'no catalog entry names a frame');
  });

  test('a new profile, scheme or brand prop on a mounted provider re-derives the theme', async function () {
    const App = function (props) {
      const { ThemeProvider } = Lib.ThemeContext;
      return React.createElement(ThemeProvider, props.theme, React.createElement(ShowcaseIndex));
    };
    let renderer;
    await act(async function () {
      renderer = TestRenderer.create(React.createElement(LibProvider, { adapters: ADAPTERS },
        React.createElement(App, { theme: { profile: 'default' } })));
    });
    assert.ok(texts(renderer.toJSON()).includes('default / light'));
    for (const next of [{ profile: 'carbon', line: 'carbon / white' }, { profile: 'carbon', scheme: 'g90', line: 'carbon / g90' }, { profile: 'material', brand: 'acme', line: 'material / light + acme' }]) {
      await act(async function () {
        renderer.update(React.createElement(LibProvider, { adapters: ADAPTERS },
          React.createElement(App, { theme: { profile: next.profile, scheme: next.scheme, brand: next.brand } })));
      });
      const lines = texts(renderer.toJSON());
      assert.ok(lines.includes(next.line), 'expected "' + next.line + '", got ' + lines.join(' | '));
    }
    await act(async function () {
      renderer.unmount();
    });
  });

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


describe('walker', function () {

  /********************************************************************
  Fire every cell's onLayout, as a native layout pass would.

  @param {Object} renderer - Test renderer

  @return {Promise<Number>} - Cells laid out
  *********************************************************************/
  async function layOut (renderer) {

    const bodies = renderer.root.findAll(function (node) {
      return typeof node.props.testID === 'string' && node.props.testID.indexOf('body-') === 0 && typeof node.props.onLayout === 'function';
    }).filter(function (node, index, all) {
      return all.findIndex(function (other) {
        return other.props.testID === node.props.testID;
      }) === index;
    });
    await act(async function () {
      for (const body of bodies) {
        body.props.onLayout({ nativeEvent: { layout: { width: 20, height: 20 } } });
      }
    });

    return bodies.length;

  }

  test('a mounted walker walks again, under the new theme, when a warm deep link changes it', async function () {
    const expected = Lib.Components.catalog.reduce(function (sum, entry) {
      return sum + entry.sample.length;
    }, 0);
    const App = function (props) {
      const { ThemeProvider } = Lib.ThemeContext;
      return React.createElement(ThemeProvider, { profile: props.profile }, React.createElement(Walker));
    };
    let renderer;
    await act(async function () {
      renderer = TestRenderer.create(React.createElement(LibProvider, { adapters: ADAPTERS }, React.createElement(App, { profile: 'default' })));
    });
    for (const profile of ['default', 'carbon', 'material']) {
      if (profile !== 'default') {
        await act(async function () {
          renderer.update(React.createElement(LibProvider, { adapters: ADAPTERS }, React.createElement(App, { profile: profile })));
        });
      }
      globalThis.__walk = undefined;
      assert.equal(await layOut(renderer), expected, profile + ': cells to lay out');
      assert.ok(globalThis.__walk, profile + ': no report was built');
      assert.equal(globalThis.__walk.theme, profile);
      assert.equal(globalThis.__walk.cells.length, expected);
      assert.ok(texts(renderer.toJSON()).some(function (line) {
        return line.indexOf('walk: done') === 0;
      }), profile + ': status');
    }
    await act(async function () {
      renderer.unmount();
    });
  });

});


describe('autopilot', function () {

  test('takes each command from the server, walks under that theme and posts the report', async function () {
    // Cells a command walks: every family's, or the named family's
    const cellsFor = function (family) {
      return Lib.Components.catalog.filter(function (entry) {
        return family === null || entry.family === family;
      }).reduce(function (sum, entry) {
        return sum + entry.sample.length;
      }, 0);
    };

    // Stub the server: GET /command answers the current command, POST /report records
    let command = null;
    const reports = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async function (url, options) {
      if (url === 'http://stub/command') {
        return { ok: true, json: async function () {
          return command;
        } };
      }
      if (url === 'http://stub/report') {
        reports.push(JSON.parse(options.body));
        return { ok: true, text: async function () {
          return '';
        } };
      }
      throw new Error('unexpected fetch ' + url);
    };

    // Unmount in `finally`: the autopilot's poll timer would otherwise keep a
    // failed run alive
    let renderer;
    try {
      await act(async function () {
        renderer = TestRenderer.create(React.createElement(LibProvider, { adapters: ADAPTERS },
          React.createElement(Autopilot, { server: 'http://stub', pollMs: 20 })));
      });
      assert.ok(texts(renderer.toJSON()).some(function (line) {
        return line.indexOf('autopilot: waiting') === 0;
      }));

      for (const next of [{ theme: 'carbon', family: null }, { theme: 'material', family: 'Icon' }]) {
        command = next;
        await act(async function () {
          await new Promise(function (done) {
            setTimeout(done, 80);
          });
        });
        assert.ok(texts(renderer.toJSON()).some(function (line) {
          return line.indexOf('autopilot: ' + next.theme + ' / ' + (next.family || 'all')) === 0;
        }), texts(renderer.toJSON()).join(' | '));
        const bodies = renderer.root.findAll(function (node) {
          return typeof node.props.testID === 'string' && node.props.testID.indexOf('body-') === 0 && typeof node.props.onLayout === 'function';
        }).filter(function (node, index, all) {
          return all.findIndex(function (other) {
            return other.props.testID === node.props.testID;
          }) === index;
        });
        const expected = cellsFor(next.family);
        assert.equal(bodies.length, expected, next.theme + ': cells');
        await act(async function () {
          for (const body of bodies) {
            body.props.onLayout({ nativeEvent: { layout: { width: 20, height: 20 } } });
          }
          await new Promise(function (done) {
            setTimeout(done, 20);
          });
        });
        const report = reports[reports.length - 1];
        assert.ok(report, next.theme + ': no report posted');
        assert.equal(report.theme, next.theme);
        assert.equal(report.family, next.family);
        assert.equal(report.cells.length, expected);
      }
      assert.equal(reports.length, 2);
    } finally {
      await act(async function () {
        renderer.unmount();
      });
      globalThis.fetch = realFetch;
    }
  });

});


describe('walk-server', function () {

  test('holds the command and writes each report under platform-theme[-family].json', async function () {
    const out = mkdtempSync(join(tmpdir(), 'walk-'));
    const script = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'walk-server.js');
    const server = spawn('node', [script, '--port', '8797', '--out', out], { stdio: 'ignore' });
    try {
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        up = await fetch('http://localhost:8797/health').then(function (response) {
          return response.ok;
        }).catch(function () {
          return false;
        });
        if (!up) {
          await new Promise(function (done) {
            setTimeout(done, 100);
          });
        }
      }
      assert.ok(up, 'walk-server did not start');

      assert.equal(await (await fetch('http://localhost:8797/command')).json(), null);
      await fetch('http://localhost:8797/command', { method: 'POST', body: JSON.stringify({ theme: 'carbon', family: 'Icon' }) });
      assert.deepEqual(await (await fetch('http://localhost:8797/command')).json(), { theme: 'carbon', family: 'Icon' });

      const posted = await fetch('http://localhost:8797/report', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ platform: 'ios', theme: 'carbon', family: 'Icon', cells: [] }) });
      assert.equal(posted.status, 200);
      assert.deepEqual(await posted.json(), { received: 'ios-carbon-Icon.json' });
      assert.ok(existsSync(join(out, 'ios-carbon-Icon.json')));
      assert.equal(JSON.parse(readFileSync(join(out, 'ios-carbon-Icon.json'), 'utf8')).theme, 'carbon');
      assert.equal((await fetch('http://localhost:8797/report', { method: 'POST', body: 'not json' })).status, 400);
    } finally {
      server.kill();
      rmSync(out, { recursive: true, force: true });
    }
  });

});


describe('walk-assert', function () {

  const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'walk-assert.js');


  /********************************************************************
  One walker report with one cell and the two required font roles.

  @param {String} platform - 'web' | 'ios'
  @param {Object} cell     - { width, height }
  @param {Object} [loaded] - { sans, mono } drawn as named (default true)

  @return {Object} - Report
  *********************************************************************/
  function fixture (platform, cell, loaded) {

    const drawn = Object.assign({ sans: true, mono: true }, loaded);

    return {
      platform: platform,
      theme: 'default',
      errors: [],
      expectedCells: 1,
      cells: [{ component: 'Button', state: 'default', width: cell.width, height: cell.height }],
      fonts: [
        { role: 'font.family.mono', family: 'Mono', drawn: drawn.mono ? 'Mono' : 'System', loaded: drawn.mono },
        { role: 'font.family.sans', family: 'Sans', drawn: drawn.sans ? 'Sans' : 'System', loaded: drawn.sans }
      ]
    };

  }


  /********************************************************************
  Run walk-assert over one native and one web report.

  @param {Object} native - Native report
  @param {Object} web    - Web report

  @return {Number} - Exit status
  *********************************************************************/
  function run (native, web) {

    const dir = mkdtempSync(join(tmpdir(), 'walk-assert-'));
    try {
      writeFileSync(join(dir, 'ios-default.json'), JSON.stringify(native));
      writeFileSync(join(dir, 'web-default.json'), JSON.stringify(web));
      return spawnSync('node', [SCRIPT, '--platform', 'ios', '--dir', dir, '--web', dir, '--themes', 'default'], { stdio: 'pipe' }).status;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

  }

  const WEB = fixture('web', { width: 100, height: 20 });

  test('widths agree within two points (one pixel rounding per platform), heights within one', function () {
    assert.equal(run(fixture('ios', { width: 101.67, height: 20.8 }), WEB), 0);
    assert.equal(run(fixture('ios', { width: 98, height: 20 }), WEB), 0);
    assert.equal(run(fixture('ios', { width: 102.5, height: 20 }), WEB), 1);
    assert.equal(run(fixture('ios', { width: 100, height: 22 }), WEB), 1);
  });

  test('a face that was not drawn (a few points on a label) and a collapsed field both fail', function () {
    assert.equal(run(fixture('ios', { width: 104, height: 20 }), WEB), 1);
    assert.equal(run(fixture('ios', { width: 20, height: 20 }), WEB), 1);
  });

  test('a cell capped by its host reports the grid room, a collapsed cell still fails', function () {
    const capped = fixture('ios', { width: 344, height: 88 });
    capped.gridWidth = 370;
    assert.equal(run(capped, fixture('web', { width: 600, height: 88 })), 0);
    const collapsed = fixture('ios', { width: 200, height: 88 });
    collapsed.gridWidth = 370;
    assert.equal(run(collapsed, fixture('web', { width: 600, height: 88 })), 1);
  });

  test('the sans and mono families must be drawn as named, natively and in the web baseline', function () {
    assert.equal(run(fixture('ios', { width: 100, height: 20 }, { mono: false }), WEB), 1);
    assert.equal(run(fixture('ios', { width: 100, height: 20 }), fixture('web', { width: 100, height: 20 }, { sans: false })), 1);
  });

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
    assert.deepEqual(Object.keys(report).sort(), ['brand', 'cells', 'components', 'errors', 'expectedCells', 'family', 'fonts', 'gridWidth', 'platform', 'schema', 'scheme', 'theme', 'tokens']);
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


describe('native-walk: the app holds focus before an Android screenshot', function () {

  const APP = 'com.anonymous.nimbusrnwdemo';
  const dump = function (focus) {
    return 'WINDOW MANAGER WINDOWS (dumpsys window windows)\n  mFocusedApp=ActivityRecord{1 u0 ' + APP + '/.MainActivity t9}\n  mCurrentFocus=' + focus + '\n';
  };

  test('the app activity is focused', function () {
    assert.equal(isAppFocused(dump('Window{4e2b3f1 u0 ' + APP + '/' + APP + '.MainActivity}'), APP), true);
  });

  test('another app\'s not-responding prompt, a prompt about the app, and no focus are not the app', function () {
    assert.equal(isAppFocused(dump('Window{9c1d0a2 u0 Application Not Responding: com.google.android.apps.nexuslauncher}'), APP), false);
    assert.equal(isAppFocused(dump('Window{9c1d0a2 u0 Application Not Responding: ' + APP + '}'), APP), false);
    assert.equal(isAppFocused(dump('null'), APP), false);
    assert.equal(isAppFocused('no focus line', APP), false);
  });

});
