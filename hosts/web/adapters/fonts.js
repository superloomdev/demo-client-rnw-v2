// Info: Web adapter for the Fonts slot. The web host has no native font
// loader: `index.html` declares its families with @font-face from
// public/fonts (IBM Plex Sans and Roboto, both SIL OFL 1.1, licenses beside
// the files), so the manifest stays empty and the adapter answers per family
// from that declared list. A family the page does not declare is reported
// as not loaded, so the system builder draws it in System and says so,
// instead of letting the browser substitute a default face silently.

// Families index.html declares; keep in step with its @font-face rules
const DECLARED_FAMILIES = ['IBM Plex Sans', 'Roboto'];


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Font extension contract over the declared list
  const adapter = {
    loadManifest: function () {
      // Return success: there is nothing to load beyond what CSS declares
      return Promise.resolve({ success: true, error: null });
    },
    isReady: function () {
      // Return true: CSS font loading never blocks the first render
      return true;
    },
    isFamilyLoaded: function (family) {
      // Return whether the page declares this family
      return Lib.Utils.inArray(DECLARED_FAMILIES, family);
    }
  };

  // Return the adapter with an empty manifest
  return {
    adapter: adapter,
    manifest: {}
  };

};
