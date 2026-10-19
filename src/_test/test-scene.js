// Info: Scene regressions: a routed screen's themed page confines its own
// overlay host, so a retained route cannot leave layers over the next
// screen; the autopilot's frame sits inside its selected provider and its
// status draws the scheme's text color.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import appLoader from '../app-core/loader.js';
import { LibProvider } from '../app-core/contexts/lib-context.js';
import Scene from '../screens/Scene.js';
import Autopilot from '../screens/walk/Autopilot.js';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };
const { Lib } = appLoader(ADAPTERS);
const { ThemeProvider } = Lib.ThemeContext;


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


/********************************************************************
Mount an element inside the app's real provider stack (LibProvider, then
ThemeProvider - which carries the app's global RootHost).

@param {Object} element - React element
@param {Object} theme   - { profile, scheme, brand }

@return {Promise<Object>} - Test renderer
*********************************************************************/
async function renderThemed (element, theme) {

  let renderer;
  await act(async function () {
    renderer = TestRenderer.create(
      React.createElement(LibProvider, { adapters: ADAPTERS },
        React.createElement(function App () {
          return React.createElement(ThemeProvider, theme, element);
        }))
    );
  });

  return renderer;

}


/********************************************************************
Every text node under a test-renderer INSTANCE (the find/findAll API has
no toJSON - host children are strings or further instances).

@param {Object} node - Renderer instance node

@return {Array} - Strings
*********************************************************************/
function instanceTexts (node) {

  return (node.children || []).flatMap(function (child) {
    return typeof child === 'string' ? [child] : instanceTexts(child);
  });

}


/********************************************************************
The overlay layer-root views a tree carries: the absolute, box-none roots
every OverlayHost paints registered layers into.

@param {Object} node - test renderer instance node

@return {Array} - Layer-root nodes
*********************************************************************/
function layerRoots (node) {

  return node.findAll(function (child) {
    return child.props && child.props.pointerEvents === 'box-none';
  });

}


describe('scene', function () {

  test('the scene root confines its local layer host inside the positioned themed view', async function () {
    const renderer = await renderThemed(
      React.createElement(Scene, null, React.createElement(Lib.ReactNative.Text, null, 'page')),
      { profile: 'carbon' });
    try {
      const template = Lib.Themes.profiles.carbon.schemes.white;
      const scene = renderer.root.find(function (node) {
        return node.props.testID === 'scene';
      });
      // The page paints the scheme's own background and is the containing box
      assert.equal(scene.props.style.backgroundColor, template.tokens['color.background']);
      assert.equal(scene.props.style.position, 'relative');
      assert.equal(scene.props.style.flex, 1);
      // The local layer root is inside the scene, not a sibling beside it
      // (react-native-web forwards the testID to the composite's inner views)
      const local = scene.findAll(function (node) {
        return node.props.testID === 'scene-layers' && node.props.pointerEvents === 'box-none';
      });
      assert.equal(local.length, 1);
    } finally {
      await act(async function () {
        renderer.unmount();
      });
    }
  });

  test('a retained scene owns its overlay layers; the global host and a quiet scene own none', async function () {

    // A controlled-open real Tooltip registers a layer on the nearest host
    function OpenTooltip () {
      const ctx = Lib.ThemeContext.useThemeController();
      return React.createElement(ctx.Registry.Tooltip, { open: true, label: 'the tip' },
        React.createElement(ctx.Registry.Text, null, 'anchor'));
    }

    // Two retained screens in one app tree: the first carries the open
    // layer, the second plain content
    const renderer = await renderThemed(
      React.createElement(React.Fragment, null,
        React.createElement(Scene, { key: 'a' },
          React.createElement(OpenTooltip)),
        React.createElement(Scene, { key: 'b' },
          React.createElement(Lib.ReactNative.Text, null, 'quiet'))),
      { profile: 'default' });
    try {
      const roots = layerRoots(renderer.root);
      // Three layer roots exist: the app's global RootHost plus one local
      // per retained scene
      assert.equal(roots.length, 3);
      const globalRoot = roots.filter(function (node) {
        return node.props.testID === undefined;
      });
      const localRoots = roots.filter(function (node) {
        return node.props.testID === 'scene-layers';
      });
      assert.equal(globalRoot.length, 1);
      assert.equal(localRoots.length, 2);
      // The tip belongs to the first scene's layer root alone: the global
      // host and the quiet scene's local root hold nothing
      const owns = localRoots.map(function (node) {
        return instanceTexts(node).includes('the tip');
      });
      assert.deepEqual(owns, [true, false]);
      assert.ok(!instanceTexts(globalRoot[0]).includes('the tip'), 'the global host holds the retained layer');
    } finally {
      await act(async function () {
        renderer.unmount();
      });
    }
  });

});


describe('autopilot frame', function () {

  test('the frame sits inside the selected provider and the status draws the scheme text color; polling does not remount the walker', async function () {

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

    // The injected frame marks itself so the tree shows where it sat
    const Marker = function (props) {
      return React.createElement(Lib.ReactNative.View, { testID: 'frame-marker' }, props.children);
    };

    let renderer;
    try {
      await act(async function () {
        renderer = TestRenderer.create(React.createElement(LibProvider, { adapters: ADAPTERS },
          React.createElement(Autopilot, { server: 'http://stub', pollMs: 20, Frame: Marker })));
      });
      // No command: the status renders plainly; no theme is read
      assert.ok(texts(renderer.toJSON()).some(function (line) {
        return line.indexOf('autopilot: waiting') === 0;
      }));

      // One command: the status is below the selected provider and draws
      // that scheme's text color
      command = { theme: 'carbon', scheme: 'g100', family: 'Icon' };
      await act(async function () {
        await new Promise(function (done) {
          setTimeout(done, 80);
        });
      });
      const status = renderer.root.find(function (node) {
        return node.props.testID === 'autopilot-command';
      });
      const expected = Lib.Themes.profiles.carbon.schemes.g100.tokens['color.text_primary'];
      assert.equal(status.props.style.color, expected);
      const frame = renderer.root.find(function (node) {
        return node.props.testID === 'frame-marker';
      });
      assert.equal(frame.findAll(function (node) {
        return node.props.testID === 'autopilot-command';
      }).length, 1, 'the status is inside the frame');
      // react-native-web forwards a testID to the composite's inner views,
      // so the walker's ScrollView reports more than one instance node
      const walkerInside = frame.findAll(function (node) {
        return node.props.testID === 'walker';
      });
      assert.ok(walkerInside.length >= 1, 'the walker is inside the frame');

      // A few more polls: the status advances but the walker element is
      // not remounted
      const walkerBefore = walkerInside[0];
      await act(async function () {
        await new Promise(function (done) {
          setTimeout(done, 60);
        });
      });
      const walkerAfter = frame.findAll(function (node) {
        return node.props.testID === 'walker';
      })[0];
      assert.ok(walkerBefore && walkerAfter, 'the walker stays mounted');
      assert.strictEqual(walkerBefore, walkerAfter, 'polling remounted the walker');
      assert.ok(texts(renderer.toJSON()).some(function (line) {
        return line.indexOf('autopilot: carbon / Icon') === 0;
      }));
    } finally {
      await act(async function () {
        renderer.unmount();
      });
      globalThis.fetch = realFetch;
    }
  });

});
