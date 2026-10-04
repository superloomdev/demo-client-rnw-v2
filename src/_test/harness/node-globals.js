// Info: The one browser global the test host supplies. react-native-web's
// TextInput compares `document.activeElement` with its node in a layout
// effect without a DOM guard; react-test-renderer runs effects, and Node
// has no `document`, so every TextInput cell would fail with a
// ReferenceError that says nothing about the app. Nothing else is
// supplied: no `window`, so react-native-web's DOM detection (which reads
// `window.document`) stays false and the host keeps rendering without a
// DOM, as this tier always has.

if (typeof globalThis.document === 'undefined') {
  globalThis.document = Object.freeze({ activeElement: null });
}
