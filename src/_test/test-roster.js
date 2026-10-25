// Info: The whole-roster showcase: getRoster merges the built catalog
// with the roster's rows and the nine planned rows, pending rows render
// to-do cards under react-test-renderer, and the three sample screens
// mount under every profile's first scheme with no diagnostics.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import appLoader from '../app-core/loader.js';
import { LibProvider } from '../app-core/contexts/lib-context.js';
import { getRoster, getTotals } from '../screens/showcase/catalog.js';
import { PLANNED_ROWS } from '../screens/showcase/planned-rows.js';
import FamilyPage from '../screens/showcase/FamilyPage.js';
import SignIn from '../screens/samples/SignIn.js';
import Settings from '../screens/samples/Settings.js';
import Records from '../screens/samples/Records.js';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };
const { Lib } = appLoader(ADAPTERS);


/********************************************************************
Render an element inside the Lib and theme providers.

@param {Object} element - Screen element
@param {Object} theme   - ThemeProvider props ({ profile, scheme })

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


/********************************************************************
Every testID prop in a rendered tree.

@param {Object} renderer - The test renderer

@return {Array} - The testID values
*********************************************************************/
function testIds (renderer) {

  return renderer.root.findAll(function (node) {
    return node.props.testID !== undefined;
  }).map(function (node) {
    return node.props.testID;
  });

}


describe('roster', function () {

  test('getRoster yields 215 rows in roster order, 73 built, the nine planned last', function () {
    const groups = getRoster(Lib.Components.catalog);
    const totals = getTotals(groups);
    assert.equal(totals.total, 215);
    assert.equal(totals.built, 73);
    const allRows = groups.reduce(function (out, group) {
      return out.concat(group.rows);
    }, []);
    // The nine planned rows close the list, in PLANNED_ROWS order
    const tail = allRows.slice(-9).map(function (row) {
      return row.name;
    });
    assert.deepEqual(tail, PLANNED_ROWS.map(function (row) {
      return row.name;
    }));
    // The planned rows form their own family at the end
    assert.equal(groups[groups.length - 1].family, 'Mobile');
    assert.equal(groups[groups.length - 1].total, 9);
    assert.equal(groups[groups.length - 1].built, 0);
  });

  test('every pending row renders a to-do card and no pending row has a catalog entry', async function () {
    const groups = getRoster(Lib.Components.catalog);
    for (const group of groups) {
      const pending = group.rows.filter(function (row) {
        return row.status === 'pending';
      });
      if (pending.length === 0) {
        continue;
      }
      const renderer = await renderThemed(React.createElement(FamilyPage, { family: group.family }), { profile: 'carbon' });
      const ids = testIds(renderer);
      for (const row of pending) {
        assert.equal(row.entry, null, row.name + ': a pending row carries no catalog entry');
        assert.ok(ids.indexOf('todo-' + row.name) !== -1, group.family + ' / ' + row.name + ': no to-do card in ' + ids.slice(0, 8).join(','));
      }
      await act(async function () {
        renderer.unmount();
      });
    }
  });

});

describe('sample screens', function () {

  const SCREENS = { 'sign-in': SignIn, 'settings': Settings, 'records': Records };

  for (const name of Object.keys(SCREENS)) {
    for (const profileName of ['default', 'carbon', 'material']) {
      test(name + ' mounts under ' + profileName + ' first scheme with zero errors and zero diagnostics', async function () {
        const scheme = Object.keys(Lib.Themes.profiles[profileName].schemes)[0];
        const probe = {};

        function Probe () {
          probe.ctx = Lib.ThemeContext.useThemeController();
          return null;
        }

        let renderer;
        await act(async function () {
          renderer = TestRenderer.create(
            React.createElement(LibProvider, { adapters: ADAPTERS },
              React.createElement(function App () {
                const { ThemeProvider } = Lib.ThemeContext;
                return React.createElement(ThemeProvider, { profile: profileName, scheme: scheme },
                  React.createElement(Probe),
                  React.createElement(SCREENS[name]));
              }))
          );
        });
        // The route's Scene carries the testID on its root view
        const scenes = renderer.root.findAll(function (node) {
          return node.props.testID === 'sample-' + name;
        });
        assert.ok(scenes.length >= 1, 'the sample screen mounts its scene');
        assert.deepEqual(probe.ctx.diagnostics, []);
        await act(async function () {
          renderer.unmount();
        });
      });
    }
  }

});
