// Info: Client-app bootstrap and dependency injection root. Imports every
// framework and helper exactly once and hands them to the rest of the app
// through the Lib container. The component library imports no framework
// (its Decision 17): React, React Native and react-native-svg reach it only
// through the `shared_libs` this loader builds.
// Returns { Lib, Config }. Memoization is owned by lib-context.js, not here.
import React from 'react';
import * as ReactNative from 'react-native';
import * as Svg from 'react-native-svg';
import jsHelperUtils from '@superloomdev/js-helper-utils';
import jsHelperDebug from '@superloomdev/js-helper-debug';
import jsClientHelperThemer from '@superloomdev/js-client-helper-themer';
import jsClientHelperThemerExtReact from '@superloomdev/js-client-helper-themer-ext-react';
import jsClientHelperFont from '@superloomdev/js-client-helper-font';
import { createSystem } from '@superloomdev/rnw-components';
import * as factories from '@superloomdev/rnw-components/all';
import { catalog } from '@superloomdev/rnw-components/catalog';
import defaultProfile from '@superloomdev/js-client-helper-themer-template-default';
import carbonProfile from '@superloomdev/js-client-helper-themer-template-carbon';
import materialProfile from '@superloomdev/js-client-helper-themer-template-material';

import { Validators } from './loader.validators.js';
import static_config from './config.js';
import { BRAND_LAYERS } from '../themes/brand-layers.js';
import fonts from '../fonts/fonts.js';
import themeContext from './contexts/theme-context.js';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Pure loader. Builds a fresh Lib + Config pair from the host-supplied
adapter set. Called once per provider mount; the provider memoizes.

@param {Object} adapters            - Host-supplied adapter factories
@param {Object} adapters.Navigation - (Lib, config) => { Link, Redirect }
@param {Object} adapters.Fonts      - (Lib, config) => { adapter, manifest }

@return {Object} result        - Runtime objects
@return {Object} result.Lib    - Dependency container with all loaded modules
@return {Object} result.Config - Fully resolved application configuration
*********************************************************************/
export default function loader (adapters) {

  // Validate the host supplied every adapter slot
  Validators.validateAdapters(adapters);

  // Merge static config (runtime overrides would be layered on here)
  const Config = {
    ...static_config,
    theme: { ...static_config.theme },
    locale: { ...static_config.locale },
    debug: { ...static_config.debug }
  };

  // Init the container
  const Lib = {};
  Lib.Config = Config;

  // Frameworks: imported once, shared by the app and the component library
  Lib.React = React;
  Lib.ReactNative = ReactNative;
  Lib.Svg = Svg;

  // Core helpers, each with only its own config slice
  Lib.Utils = jsHelperUtils(Lib, {});
  Lib.Debug = jsHelperDebug(Lib, Config.debug);

  // Theme engine and its React extension
  Lib.Themer = jsClientHelperThemer(Lib, {});
  Lib.ThemerReact = jsClientHelperThemerExtReact({
    React: Lib.React,
    Themer: Lib.Themer,
    Utils: Lib.Utils,
    Debug: Lib.Debug
  });

  // Font core; the platform loader and manifest arrive through the Fonts adapter
  Lib.Font = jsClientHelperFont(Lib, { DEFAULT_FAMILY: 'System' });
  const fontsResult = adapters.Fonts(Lib, {});
  Lib.FontAdapter = fontsResult.adapter;
  Lib.FontManifest = fontsResult.manifest;
  Lib.Fonts = fonts(Lib);

  // Navigation surface from the host
  Lib.Navigation = adapters.Navigation(Lib, {});

  // Theme data: one profile per template package, plus the sparse brand layers
  Lib.Themes = {
    profiles: {
      default: defaultProfile,
      carbon: carbonProfile,
      material: materialProfile
    },
    brands: BRAND_LAYERS
  };

  // The component library: its one entry point, every factory it exports,
  // and the catalog (family, tier, platform, flags, sample states per component)
  Lib.Components = {
    createSystem: createSystem,
    factories: factories,
    catalog: catalog
  };

  // Theming hub (provider + hooks); needs Themes, Fonts, Components
  Lib.ThemeContext = themeContext(Lib);

  // Return the container and the config
  return { Lib: Lib, Config: Config };

}/////////////////////////// Module-Loader END /////////////////////////////////
