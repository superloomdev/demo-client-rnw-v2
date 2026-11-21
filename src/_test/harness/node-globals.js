// Info: The two browser globals the test host supplies.
//
// `document`: react-native-web's TextInput compares `document.activeElement`
// with its node in a layout effect without a DOM guard; react-test-renderer
// runs effects, and Node has no `document`, so every TextInput cell would
// fail with a ReferenceError that says nothing about the app.
//
// `window`: react-native-web's Image starts its load in an effect with
// `new window.Image()` (`modules/ImageLoader/index.js:103`), unguarded, so
// every image cell would fail the same way. The window holds an Image that
// never loads and a zero viewport, which is what the library's DOM helpers
// already read where there is no window (`behaviors/dom.js` getViewport).
// It has no `document`, so react-native-web's DOM detection (which reads
// `window.document`) stays false and the host keeps rendering without a
// DOM, as this tier always has.

if (typeof globalThis.document === 'undefined') {
  globalThis.document = Object.freeze({ activeElement: null });
}

// An image element that takes its handlers and source and never loads
class NodeImage {}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = Object.freeze({ Image: NodeImage, innerHeight: 0, innerWidth: 0 });
}
