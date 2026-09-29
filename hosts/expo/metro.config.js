// Info: Metro bundler config - the SINGLE pipeline for web (RNW) + iOS + Android.
//
// All Superloom helper modules are consumed from the GitHub Packages registry
// as normal npm dependencies.
//
// The src/ directory is watched because shared source (screens, themes,
// fonts, app-core) lives outside the Expo project root.

// CommonJS is required here: the Metro/Expo CLI loads this config through
// require(), so this file cannot be an ES module.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Start from Expo's default Metro config
const config = getDefaultConfig(__dirname);

// src/ root - shared source lives here, outside the Expo project root
const SRC_ROOT = path.resolve(__dirname, '../../src');

// The component library is file:-linked from its sibling repository; Metro
// follows the symlink and must watch the real path
const LIBRARY_ROOT = path.resolve(__dirname, '../../../codebase-rnw-components-v2');

// Tell Metro to watch the shared source and the library outside the Expo project root
config.watchFolders = [...(config.watchFolders || []), SRC_ROOT, LIBRARY_ROOT];

const CLIENT_MODULES = path.resolve(__dirname, 'node_modules');

config.resolver.nodeModulesPaths = [CLIENT_MODULES];

// Metro does not read package.json "exports" by default at this Expo/RN
// version. Every Superloom module publishes an "exports" map and no "main",
// so resolution fails without this. Enabled by default from Metro 0.82.
config.resolver.unstable_enablePackageExports = true;

// helper-utils imports `createRequire` from `node:module` for its Node-only
// JSON loading; no Metro platform has that module, so it resolves to a stub
// whose `createRequire` returns a loader that throws only if it is called
const NODE_MODULE_STUB = path.resolve(__dirname, 'node-module-stub.js');
config.resolver.resolveRequest = function (context, moduleName, platform) {
  if (moduleName === 'node:module') {
    return { type: 'sourceFile', filePath: NODE_MODULE_STUB };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
