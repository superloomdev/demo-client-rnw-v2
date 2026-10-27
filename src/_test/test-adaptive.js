// Info: The adaptive host seam: per-template brands picked by polarity,
// the provider's variant build from the window's form class and the
// host's platform, the text scale reaching the system's type sets, the OS
// switch adapter under the system enum and the diagnostic the seam
// reports when the adapter is absent.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import appLoader from '../app-core/loader.js';
import { LibProvider } from '../app-core/contexts/lib-context.js';
import carbon from '@superloomdev/js-client-helper-themer-template-carbon';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };
const { Lib } = appLoader(ADAPTERS);
const { ThemeProvider } = Lib.ThemeContext;


/********************************************************************
Mount a probe inside the real provider stack. The probe reads the theme
controller and records it where the test can read it.

@param {Object} theme  - ThemeProvider props (profile, scheme, form...)
@param {Number} width  - the window width the provider sees (optional)

@return {Promise<Object>} - { renderer, probe: { ctx } }
*********************************************************************/
async function renderThemed (theme, width) {

  const probe = {};
  // The react-native module namespace is read-only, so the stub is a full
  // merged copy: the system's own Object.assign would drop prototype
  // members, and a namespace assignment would throw
  const originalRN = Lib.ReactNative;
  if (width !== undefined) {
    Lib.ReactNative = Object.assign({}, originalRN, {
      useWindowDimensions: function () {
        return { width: width, height: 800 };
      }
    });
  }

  function Probe () {
    probe.ctx = Lib.ThemeContext.useThemeController();
    return null;
  }

  let renderer;
  try {
    await act(async function () {
      renderer = TestRenderer.create(
        React.createElement(LibProvider, { adapters: ADAPTERS },
          React.createElement(function App () {
            return React.createElement(ThemeProvider, theme,
              React.createElement(Probe));
          }))
      );
    });
  } finally {
    Lib.ReactNative = originalRN;
  }

  return { renderer: renderer, probe: probe };

}


/********************************************************************
Build a system directly, as build-system.js does, with a given adapter
set and diagnostic sink.

@param {Object} template        - The theme template (a scheme object)
@param {Object} variant         - { form, platform }
@param {Object} adapters        - shared_libs.adapters value
@param {Function} onDiagnostic  - diagnostic sink (optional)

@return {Object} - { Registry, records }
*********************************************************************/
function buildSystem (template, variant, adapters, onDiagnostic) {

  const records = [];
  const built = Lib.Themer.buildTheme(template, [], 'native', {
    variant: variant,
    adaptive: 'auto'
  });
  // The Toggle dispatcher routes on Platform.OS, so a build meant for ios
  // needs a stubbed native platform, not the web's react-native
  const nativeRN = Object.assign({}, Lib.ReactNative, {
    Platform: Object.assign({}, Lib.ReactNative.Platform, { OS: 'ios' })
  });
  const Registry = Lib.Components.createSystem({
    React: Lib.React,
    ReactNative: nativeRN,
    Svg: Lib.Svg,
    Utils: Lib.Utils,
    Debug: Lib.Debug,
    Themer: Lib.Themer,
    adapters: adapters
  }, {
    onDiagnostic: onDiagnostic || function (record) {
      records.push(record);
    }
  }, built, 'md', Lib.Components.factories);
  return { Registry: Registry, records: records };

}


describe('adaptive host seam', function () {

  test('each profile carries its template\'s sample brands plus acme', function () {
    assert.deepEqual(Object.keys(Lib.Themes.profiles.default.brands).sort(), ['acme', 'rounded']);
    assert.deepEqual(Object.keys(Lib.Themes.profiles.carbon.brands).sort(), ['acme', 'rounded', 'superloom']);
  });

  test('a brand is picked by polarity', async function () {
    const light = await renderThemed({ profile: 'carbon', scheme: 'white', brand: 'superloom' });
    const dark = await renderThemed({ profile: 'carbon', scheme: 'g100', brand: 'superloom' });
    assert.equal(light.probe.ctx.built.tokens['color.interactive'], '#8a3ffc');
    assert.equal(dark.probe.ctx.built.tokens['color.interactive'], '#a56eff');
  });

  test('the provider builds with variant form and platform', async function () {
    const result = await renderThemed({ profile: 'carbon', scheme: 'white' }, 375);
    assert.equal(result.probe.ctx.resolvedForm, 'compact');
    assert.equal(result.probe.ctx.platform, 'web');
    assert.equal(result.probe.ctx.built.tokens['control.target_min'], 48);
    assert.equal(result.probe.ctx.built.tokens['control.field_height'], 48);
  });

  test('form in state overrides the width', async function () {
    const result = await renderThemed({ profile: 'carbon', scheme: 'white', form: 'compact' }, 1280);
    assert.equal(result.probe.ctx.resolvedForm, 'compact');
    assert.equal(result.probe.ctx.built.tokens['control.field_height'], 48);
  });

  test('adaptive fixed ignores the variants', async function () {
    const result = await renderThemed({ profile: 'carbon', scheme: 'white', adaptive: 'fixed' }, 375);
    assert.equal(result.probe.ctx.built.tokens['control.field_height'], 40);
    assert.equal(result.probe.ctx.built.tokens['control.target_min'], 24);
  });

  test('textScale reaches the system', async function () {
    const result = await renderThemed({ profile: 'carbon', scheme: 'white', textScale: 2 }, 1280);
    const Toggle = result.probe.ctx.Registry.Toggle;
    let renderer;
    await act(async function () {
      renderer = TestRenderer.create(React.createElement(Toggle, { label: 'lbl', checked: false }));
    });
    const label = renderer.root.findAll(function (node) {
      return node.children.indexOf('lbl') !== -1;
    })[0];
    const flat = Array.isArray(label.props.style) ? Object.assign.apply(Object, [{}].concat(label.props.style)) : label.props.style;
    // carbon label01: fontSize 12 at scale 1; the host's 2 doubles it,
    // clamped at the theme maximum (the web host emits unit strings)
    assert.equal(flat.fontSize, '24px');
  });

  test('the system Switch adapter is passed', function () {
    function StubSwitch () {
      return Lib.React.createElement('switch-stub', { testID: 'stub-switch' });
    }

    const { Registry } = buildSystem(carbon.schemes.white, { form: 'expanded', platform: 'ios' }, { Switch: StubSwitch });
    const Toggle = Registry.Toggle;
    let renderer;
    act(function () {
      renderer = TestRenderer.create(React.createElement(Toggle, { label: 'lbl', checked: false }));
    });
    assert.equal(renderer.root.findAllByType('switch-stub').length, 1);
  });

  test('diagnostics are collected', function () {
    const { Registry, records } = buildSystem(carbon.schemes.white, { form: 'expanded', platform: 'ios' }, {});

    act(function () {
      TestRenderer.create(React.createElement(Registry.Toggle, { label: 'lbl', checked: false }));
    });
    assert.deepEqual(records.filter(function (record) {
      return record.code === 'adapter_missing';
    }), [{ code: 'adapter_missing', adapter: 'Switch', component: 'Toggle' }]);
  });

});
