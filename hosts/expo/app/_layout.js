// Info: Root layout - the app boot. Builds the Lib container (LibProvider),
// holds render until the host's fonts have loaded, and provides the theme.
// The URL (web) or deep link (native) may select the theme with
// ?profile=&scheme=&brand=; the default profile is used otherwise.
import { Stack, useGlobalSearchParams } from 'expo-router';
import { LibProvider, useLib } from '../../../src/app-core/contexts/lib-context.js';
import navigationAdapter from '../adapters/navigation.js';
import fontsAdapter from '../adapters/fonts.js';

// Stable adapter set: LibProvider memoizes the container on this reference
const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };


// Inner boot: hold render until host fonts are ready, then provide the theme
function Boot () {

  const Lib = useLib();
  const React = Lib.React;
  const params = useGlobalSearchParams();

  // Load fonts asynchronously via the font helper adapter
  const [fontsReady, setFontsReady] = React.useState(Lib.Fonts.isReady());

  React.useEffect(function () {

    // Already ready (system-only build) - skip the async load
    if (Lib.Fonts.isReady()) {
      return;
    }

    // Trigger the async font load, then flip the ready flag
    Lib.Fonts.loadFonts().then(function () {
      setFontsReady(true);
    });

  }, []);

  // Block render until every registered font family has loaded
  if (!fontsReady) {
    return null;
  }

  // Provide the selected theme to every route
  const { ThemeProvider } = Lib.ThemeContext;
  return (
    <ThemeProvider profile={params.profile} scheme={params.scheme} brand={params.brand}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );

}


export default function RootLayout () {
  return (
    <LibProvider adapters={ADAPTERS}>
      <Boot />
    </LibProvider>
  );
}
