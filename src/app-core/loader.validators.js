// Info: Loader validators. Validates the host-supplied adapter set before the
// container is built. A missing or malformed adapter is a programmer error, so
// it throws synchronously rather than returning an envelope.


// The adapter slots every host must supply. Icons are not a slot: glyphs are
// theme tokens drawn by the component library through react-native-svg.
const REQUIRED_ADAPTERS = ['Navigation', 'Fonts'];


/////////////////////////// Public Functions START /////////////////////////////
const Validators = {


  /********************************************************************
  Validate the host-supplied adapter set. Throws on the first problem,
  naming every missing slot in one message so a misconfigured host is
  fixed in one pass.

  Raw `typeof` is used deliberately: this runs before Lib.Utils exists,
  so the Utils type primitives are not yet available.

  @param {Object} adapters - map of slot name to adapter factory

  @return {undefined}
  *********************************************************************/
  validateAdapters: function (adapters) {

    // The set itself must be a plain object
    if (adapters === null || typeof adapters !== 'object') {
      throw new TypeError('loader: adapters must be an object supplying ' + REQUIRED_ADAPTERS.join(', '));
    }

    // Collect every slot that is missing or not a factory function
    const missing = REQUIRED_ADAPTERS.filter(function (slot) {
      return typeof adapters[slot] !== 'function';
    });

    // Report all of them at once
    if (missing.length > 0) {
      throw new TypeError('loader: missing or invalid adapter slots: ' + missing.join(', '));
    }

  }


};/////////////////////////// Public Functions END //////////////////////////////


export { REQUIRED_ADAPTERS, Validators };
