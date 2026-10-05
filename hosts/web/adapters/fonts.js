// Info: Web adapter for the Fonts slot. The web host has no native font
// loader: `index.html` declares its families with @font-face from
// public/fonts (IBM Plex Sans, IBM Plex Mono, Roboto and Roboto Mono, all SIL OFL 1.1, licenses beside
// the files; the same binaries the Expo host loads from @expo-google-fonts,
// so web and native shape text with one set of metrics), so the manifest
// stays empty. `main.jsx` loads every declared face before the first render,
// as the Expo root holds render until its fonts load. A family counts as
// loaded only when the browser actually loaded it: a declared face whose
// file is missing or not a font is reported as not loaded, so the system
// builder draws it in System and says so, instead of letting the browser
// substitute a default face silently.

// Faces index.html declares; keep in step with its @font-face rules
export const DECLARED_FACES = [
  '300 16px "IBM Plex Sans"',
  '400 16px "IBM Plex Sans"',
  '500 16px "IBM Plex Sans"',
  '600 16px "IBM Plex Sans"',
  '700 16px "IBM Plex Sans"',
  '400 16px "Roboto"',
  '500 16px "Roboto"',
  '600 16px "Roboto"',
  '700 16px "Roboto"',
  '400 16px "IBM Plex Mono"',
  '400 16px "Roboto Mono"'
];


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Font extension contract over the faces the page declares and loaded
  const adapter = {
    loadManifest: function () {
      // Return success: main.jsx has loaded every declared face before rendering
      return Promise.resolve({ success: true, error: null });
    },
    isReady: function () {
      // Return true: the first render waits for the faces in main.jsx
      return true;
    },
    isFamilyLoaded: function (family) {
      // Return whether the browser holds a loaded face of this family
      return Array.from(document.fonts).some(function (face) {
        return face.family.replace(/["']/g, '') === family && face.status === 'loaded';
      });
    }
  };

  // Return the adapter with an empty manifest
  return {
    adapter: adapter,
    manifest: {}
  };

};
