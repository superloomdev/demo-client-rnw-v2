// Info: Babel config for the Expo (Metro) pipeline used by web + iOS + Android.
// We keep this intentionally minimal and bundler-agnostic: `babel-preset-expo`
// already wires React Native Web aliasing and the Expo Router transform, so the
// application code never depends on a webpack- or metro-specific plugin.

// CommonJS is required here: the Metro/Expo CLI loads this config through
// require(), so this file cannot be an ES module.
module.exports = function (api) {

  // Cache the computed config (standard Babel performance practice)
  api.cache(true);

  // Return the preset set
  return {
    presets: ['babel-preset-expo']
  };

};
