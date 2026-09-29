// Info: React bridge for the Lib container. Builds Lib once per provider mount
// (memoized on the adapters reference) and exposes it through context so any
// screen/component can call useLib() to reach the SDK, helper modules
// (Utils/Debug), the theme engine, etc. Memoization lives here, not in the
// loader, so each provider mount gets a fresh container.
import React from 'react';
import loader from '../loader.js';

const LibCtx = React.createContext(null);


// Provider: build Lib (memoized on adapters) and supply it to the tree
function LibProvider (props) {
  // Build Lib once per mount, memoized on the adapters reference
  const Lib = React.useMemo(function () {
    // Return the Lib container from the loader so it is fresh per mount
    return loader(props.adapters).Lib;
  }, [props.adapters]);

  // Return the provider element so the tree can consume Lib via context
  return React.createElement(LibCtx.Provider, { value: Lib }, props.children);
}


// Hook: read the Lib container
function useLib () {
  // Return the Lib container from context so consumers can reach the SDK
  return React.useContext(LibCtx);
}


export { LibProvider, useLib, LibCtx };
