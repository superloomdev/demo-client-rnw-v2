// Info: Test-tier stub adapter for the Fonts slot.
// System-only: no platform font loader, empty manifest. Returns the minimal
// contract surface the app-core loader expects from a Fonts adapter:
// { adapter: { loadManifest, isReady, isFamilyLoaded }, manifest: {} }.


/********************************************************************
Fonts adapter factory. Returns the Fonts contract with stub methods
that always report success and readiness (no real font loading in tests).

@param {Object} Lib    - Lib container (unused in stub)
@param {Object} config - Config (unused in stub)

@return {Object} result          - Fonts adapter result
@return {Object} result.adapter  - { loadManifest, isReady, isFamilyLoaded }
@return {Object} result.manifest - Empty font manifest
*********************************************************************/
export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Stub adapter methods: all succeed immediately
  const adapter = {
    loadManifest: function () {
      return Promise.resolve({ success: true, error: null });
    },
    isReady: function () {
      return true;
    },
    isFamilyLoaded: function () {
      return true;
    }
  };

  // Empty manifest: no font assets in tests
  const manifest = {};

  return {
    adapter: adapter,
    manifest: manifest
  };

};
