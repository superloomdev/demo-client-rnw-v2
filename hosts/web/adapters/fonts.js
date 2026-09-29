// Info: Web adapter for the Fonts slot.
// System-only: no platform font loader, empty manifest.
// The harness proves portability, not font rendering.


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Minimal no-op font adapter satisfying the font extension contract
  const adapter = {
    loadManifest: function () {
      return Promise.resolve({ success: true, error: null });
    },
    isReady: function () {
      // Return true: the web host declares its fonts through CSS, so there is
      // no asynchronous load for this adapter to be waiting on
      return true;
    },
    isFamilyLoaded: function () {
      // Return true for every family: the web host resolves families through
      // CSS @font-face, which this adapter cannot inspect, so it cannot report
      // a per-family answer and must not block the caller
      return true;
    }
  };

  // IBM Plex Sans is loaded via @font-face in index.html (Google Fonts CDN).
  // The web adapter has no native font loader, so the manifest stays empty.
  // The @font-face declaration makes the family available to CSS directly;
  // the font system's isFamilyLoaded returns true for all families on web.
  const manifest = {};

  return {
    adapter: adapter,
    manifest: manifest
  };

};
