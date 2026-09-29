// Info: Stub for node:module in the Metro pipeline (web, iOS, Android).
// No Metro platform has createRequire; helper-utils imports it for Node-only
// JSON loading that no client path calls, so the returned loader throws only
// if something does call it.
export function createRequire () {
  return function () {
    throw new Error('createRequire is not available in the Metro pipeline');
  };
}
