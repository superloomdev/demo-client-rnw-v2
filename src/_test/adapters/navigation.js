// Info: Test-tier stub adapter for the Navigation slot.
// Provides minimal Link and Redirect functions for component tests.
// Matches the contract the app-core loader expects: { Link, Redirect }.
import React from 'react';


/********************************************************************
Navigation adapter factory. Returns a Navigation contract with stub
Link (renders an anchor tag) and Redirect (renders null).

@param {Object} Lib    - Lib container (unused in stub)
@param {Object} config - Config (unused in stub)

@return {Object} - { Link, Redirect }
*********************************************************************/
export default function (Lib, config) { // eslint-disable-line no-unused-vars

  return {
    // Stub Link: renders an anchor element
    Link: function (props) {
      return React.createElement('a', { href: props.href }, props.children);
    },

    // Stub Redirect: no-op, renders nothing
    Redirect: function () {
      return null;
    }
  };

};
