// Info: Node ESM resolve hook for the test host.
//
// 1. The app source lives in src/ (outside _test/), so Node cannot find the
//    packages installed in _test/node_modules without a redirect.
// 2. `react-native` is installed here as react-native-web (a package alias),
//    exactly what the web bundler does.
// 3. `react-native-svg` resolves to ./svg-stub.js: its web build is
//    bundler-only (extensionless imports, CommonJS parser output) and cannot
//    load in plain Node. The real react-native-svg is exercised by the web
//    build and the Expo export; this tier checks composition, not drawing.

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.resolve(__dirname, '..');
const require = createRequire(testDir + '/');

// Packages that src/ imports but are only installed in _test/node_modules
const REDIRECTS = [
  'react',
  'react-dom',
  'react-native',
  'react-test-renderer',
  '@superloomdev/js-helper-utils',
  '@superloomdev/js-helper-debug',
  '@superloomdev/js-client-helper-themer',
  '@superloomdev/js-client-helper-themer-ext-react',
  '@superloomdev/js-client-helper-font',
  '@superloomdev/rnw-components',
  '@superloomdev/js-client-helper-themer-template-default',
  '@superloomdev/js-client-helper-themer-template-carbon',
  '@superloomdev/js-client-helper-themer-template-material'
];

const SVG_STUB = pathToFileURL(path.join(__dirname, 'svg-stub.js')).href;


export function resolve (specifier, context, nextResolve) {

  // The svg stub, from anywhere
  if (specifier === 'react-native-svg') {
    return { shortCircuit: true, url: SVG_STUB };
  }

  // A redirected package or a subpath of one resolves from _test/node_modules
  for (const pkg of REDIRECTS) {
    if (specifier === pkg || specifier.startsWith(pkg + '/')) {
      return { shortCircuit: true, url: pathToFileURL(require.resolve(specifier)).href };
    }
  }

  return nextResolve(specifier, context);

}
