// Info: Web host entry. Renders the shared app source under Vite to prove the
// portability contract: src/ builds under a non-Expo bundler. Routes by path:
//   /                    showcase index
//   /showcase/<Family>   one family, every sample state
//   /walk[/<Family>]     the walker (?report=<url> POSTs its report)
// The query selects the theme: ?profile=|theme=default|carbon|material,
// &scheme=<s>, &brand=<b>.

import React from 'react';
import { createRoot } from 'react-dom/client';

import { LibProvider, useLib } from '../../src/app-core/contexts/lib-context.js';
import navigationAdapter from './adapters/navigation.js';
import fontsAdapter from './adapters/fonts.js';

import ShowcaseIndex from '../../src/screens/showcase/ShowcaseIndex.js';
import FamilyPage from '../../src/screens/showcase/FamilyPage.js';
import Walker from '../../src/screens/walk/Walker.js';

// Stable adapter set: LibProvider memoizes the container on this reference
const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };


// Pick the screen for the current path
function Screen () {

  const segments = window.location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);

  if (segments[0] === 'showcase' && segments[1]) {
    return <FamilyPage family={decodeURIComponent(segments[1])} />;
  }
  if (segments[0] === 'walk') {
    return <Walker family={segments[1] ? decodeURIComponent(segments[1]) : undefined} report={params.get('report') || undefined} />;
  }

  return <ShowcaseIndex />;

}


// Themed app: reads the selection from the URL once per load
function App () {

  const Lib = useLib();
  const { ThemeProvider } = Lib.ThemeContext;
  const params = new URLSearchParams(window.location.search);

  return (
    <ThemeProvider
      profile={params.get('profile') || params.get('theme') || undefined}
      scheme={params.get('scheme') || undefined}
      brand={params.get('brand') || undefined}
    >
      <Screen />
    </ThemeProvider>
  );

}


const root = createRoot(document.getElementById('root'));
root.render(
  <LibProvider adapters={ADAPTERS}>
    <App />
  </LibProvider>
);
