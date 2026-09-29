// Info: Host font manifest - owns LOADING the font families that themes NAME.
// Keeping loading here (not in the themer package) is deliberate: importing font.ttf
// is bundler-bound and a server-sent theme JSON cannot carry binaries, so the
// engine stays bundler-agnostic. Contract: if a theme names family X, this file
// must register X.
//
// The font asset sources (Google Fonts packages, bundled .ttf files) are
// bundler-bound and host-specific. The host provides them via Lib.FontManifest,
// a plain map of family names to style entries. This file stays bundler-agnostic.
//
// Loader pattern: SINGLETON with dependency injection. The font core (Lib.Font)
// and the platform adapter (Lib.FontAdapter) arrive via Lib, matching the
// centralized-deps pattern.


// Custom bundled fonts (local .ttf requires; {} until assets are added)
import CustomFonts from './assets/index.js';


// The font manifest is built in the loader from Lib.FontManifest (host-provided)
// plus any local custom assets. Module-scope variable set by the loader.
let FONT_MANIFEST = {};


// Injected dependencies, set by the loader (module-scope).
let Lib;           // shared_libs container (requires Lib.Font, Lib.FontAdapter)
let Font;          // font core instance (required)
let FontAdapter;   // platform font loader adapter (required)


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects the font core + adapter via Lib, registers
font families from the manifest, and returns the font interface.

@param {Object} shared_libs - Lib container; requires Font + FontAdapter

@return {Object} - { families, loadFonts, isReady }
*********************************************************************/
export default function loader (shared_libs) {

  // Capture injected deps
  Lib = shared_libs || {};

  // Font core and adapter are required
  Font = Lib.Font;
  FontAdapter = Lib.FontAdapter;
  if (!Font) {
    throw new TypeError('fonts: Lib.Font is required (inject the helper-font instance).');
  }
  if (!FontAdapter) {
    throw new TypeError('fonts: Lib.FontAdapter is required (inject a font loader adapter).');
  }

  // Build the font manifest from the host-provided manifest (Lib.FontManifest)
  // plus any local custom .ttf assets
  const hostManifest = Lib.FontManifest || {};
  FONT_MANIFEST = Object.assign({}, hostManifest);
  const CustomKeys = Object.keys(CustomFonts);
  for (let i = 0; i < CustomKeys.length; i++) {
    const key = CustomKeys[i];
    FONT_MANIFEST[key] = {
      styles: {
        normal: {
          asset: CustomFonts[key],
          weight: '400',
          style: 'normal'
        }
      }
    };
  }

  // Register families from the manifest into the font core
  Font.registerFamilies(FONT_MANIFEST);

  // 'System' is always available; the rest are whatever the manifest registers
  const manifestResult = Font.getManifest();
  if (manifestResult.success) {
    Fonts.families = ['System'].concat(Object.keys(manifestResult.manifest));
  }

  // Return the public font interface to the host
  return Fonts;

};/////////////////////////// Module-Loader END ////////////////////////////////



/////////////////////////// Public Functions START /////////////////////////////
const Fonts = { // Public font-manifest interface accessible by the host


  // ~~~~~~~~~~ Registry ~~~~~~~~~~
  // The family names this app has registered (filled by the loader). 'System'
  // is always present; bundled/Google families appear once their modules resolve.

  families: ['System'],


  // ~~~~~~~~~~ Loading ~~~~~~~~~~

  /********************************************************************
  Async: load every registered font via the platform adapter. Returns a
  Promise that resolves once all fonts have been loaded (or failed
  gracefully). The host root layout calls this in a useEffect and holds
  render until isReady() returns true.

  System-only builds resolve instantly (the manifest may be empty). A
  missing custom .ttf is simply absent from the manifest, so this never
  blocks on an unadded file.

  @return {Promise<Object>} - { success, error }
  *********************************************************************/
  loadFonts: async function () {

    // Nothing to load asynchronously -> ready immediately
    const manifestResult = Font.getManifest();
    if (!manifestResult.success || Lib.Utils.isEmptyObject(manifestResult.manifest)) {
      return { success: true, error: null };
    }

    // Delegate to the platform adapter
    return FontAdapter.loadManifest(manifestResult.manifest);

  },


  /********************************************************************
  Check whether all registered fonts have finished loading.

  @return {Boolean} - true once all registered fonts are loaded
  *********************************************************************/
  isReady: function () {

    // Query the adapter and report whether all registered fonts are loaded
    return FontAdapter.isReady();

  },


  /********************************************************************
  Async: register and load a single font family at runtime. Used by
  the theme context when a theme references a family that is not yet
  loaded. Skips 'System' (always available) and families already
  loaded by the adapter.

  @param {String} familyName - The family name to load

  @return {Promise<Object>} - { success, error }
  *********************************************************************/
  loadFamily: async function (familyName) {

    // System is always available, no loading needed
    if (familyName === 'System') {
      return { success: true, error: null };
    }

    // Check if the family is already loaded by the adapter. The adapter
    // contract returns a bare Boolean per the is/has naming doctrine, so a
    // direct truthiness test is correct here.
    if (FontAdapter.isFamilyLoaded(familyName)) {
      return { success: true, error: null };
    }

    // Check if the family is in the font manifest
    if (!FONT_MANIFEST[familyName]) {

      // Family not in manifest, cannot load it
      return {
        success: false,
        error: {
          type: 'fonts/family-not-in-manifest',
          message: 'Family "' + familyName + '" is not in the font manifest'
        }
      };

    }

    // Register the family in the font core if not already registered
    if (!Font.isRegistered(familyName)) {
      const singleManifest = {};
      singleManifest[familyName] = FONT_MANIFEST[familyName];
      Font.registerFamilies(singleManifest);
    }

    // Load just this family via the adapter
    const singleManifest = {};
    singleManifest[familyName] = FONT_MANIFEST[familyName];

    return FontAdapter.loadManifest(singleManifest);

  }


};/////////////////////////// Public Functions END //////////////////////////////
