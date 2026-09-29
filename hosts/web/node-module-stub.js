// Info: Browser stub for node:module. The web build runs in a browser;
// createRequire is not available. helper-utils uses it for JSON loading
// which is not needed in the browser bundle.
export function createRequire () {
  return function () {
    throw new Error('createRequire is not available in the browser');
  };
}
