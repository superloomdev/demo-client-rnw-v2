// Info: Web host entry. Renders the shared app source under Vite to prove the
// portability contract: src/ builds under a non-Expo bundler. The query
// string selects the theme: ?profile=default|carbon|material&scheme=<s>&brand=<b>.

import React from 'react';
import { createRoot } from 'react-dom/client';

import { LibProvider, useLib } from '../../src/app-core/contexts/lib-context.js';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

import Home from '../../src/screens/home/Home.js';

// Stable adapter set: LibProvider memoizes the container on this reference
const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };


// Themed app: reads the selection from the URL once per load
function App () {

  const Lib = useLib();
  const { ThemeProvider } = Lib.ThemeContext;
  const params = new URLSearchParams(window.location.search);

  return (
    <ThemeProvider
      profile={params.get('profile') || undefined}
      scheme={params.get('scheme') || undefined}
      brand={params.get('brand') || undefined}
    >
      <Home />
    </ThemeProvider>
  );

}


const root = createRoot(document.getElementById('root'));
root.render(
  <LibProvider adapters={ADAPTERS}>
    <App />
  </LibProvider>
);
