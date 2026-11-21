// Info: Expo adapter for the Widgets slot on web. The library's web halves
// draw their own date picker and pick files through the document's file
// input, so the web export seats no OS widget. Metro resolves
// `widgets.native.js` on iOS and Android.


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // No system widget on web
  return {};

}
