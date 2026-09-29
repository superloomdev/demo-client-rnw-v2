// Info: System builder for the demo application. Resolves every theme font
// role against the fonts the host has registered, falls back to System for a
// family the host does not carry (and asks the host to load it once), then
// builds the component system through the library's one entry point.
//
// The built theme is never mutated: the engine may hand back a cached
// object, so the font fallback writes into a copy of the token map.


// Families whose async load has already been attempted this session. A
// family the host manifest does not carry must not re-trigger a re-derive
// on every build, which would spin the theme forever.
const ATTEMPTED = new Set();


// RNW component libraries always consume the native theme projection on
// every platform including web. RNW is itself the web projection;
// requesting web applies two projections and yields unit strings that
// React Native cannot consume on iOS or Android.
export const THEME_PLATFORM = 'native';


/********************************************************************
Build the component system from a built theme.

@param {Object}   Lib        - the dependency container
@param {Object}   built      - the Themer's buildTheme result (native)
@param {Function} rederive   - called when an async font load lands
@param {String}   breakpoint - a contract breakpoint name

@return {Object} - { Registry, tokens, fallbacks }
*********************************************************************/
export function buildSystem (Lib, built, rederive, breakpoint) {

  // Init a copy of the token map the font fallback may write into
  const tokens = Object.assign({}, built.tokens);
  const fallbacks = [];

  // Resolve each font family role against the host's registered fonts
  const roles = Object.keys(tokens).filter(function (key) {
    return key.indexOf('font.family.') === 0;
  });
  for (const role of roles) {

    // A registered family, or System, is used as the theme names it
    const family = tokens[role];
    if (family === 'System' || Lib.Font.isRegistered(family)) {
      continue;
    }

    // Anything else draws in System until the host has it
    tokens[role] = 'System';
    fallbacks.push(role + '=' + family);

    // Ask the host to load it once; re-derive only when it really landed
    if (!ATTEMPTED.has(family)) {
      ATTEMPTED.add(family);
      Lib.Fonts.loadFamily(family).then(function (result) {
        if (result.success && Lib.Font.isRegistered(family) && Lib.Utils.isFunction(rederive)) {
          rederive();
        }
      });
    }

  }

  // Report the fallbacks once per build, at warn level
  if (!Lib.Utils.isEmptyArray(fallbacks)) {
    Lib.Debug.warn('theme: host does not carry ' + fallbacks.join(', ') + '; drawing in System');
  }

  // Build the system through the library's one entry point
  const Registry = Lib.Components.createSystem({
    React: Lib.React,
    ReactNative: Lib.ReactNative,
    Svg: Lib.Svg,
    Utils: Lib.Utils,
    Debug: Lib.Debug,
    Themer: Lib.Themer
  }, {}, Object.assign({}, built, { tokens: tokens }), breakpoint, Lib.Components.factories);

  // Return the registry, the tokens it was built from and what fell back
  return { Registry: Registry, tokens: tokens, fallbacks: fallbacks };

}


export default buildSystem;
