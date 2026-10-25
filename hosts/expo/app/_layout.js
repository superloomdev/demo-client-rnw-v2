// Info: Root layout - the app boot. Builds the Lib container (LibProvider),
// holds render until the host's fonts have loaded, and provides the theme.
// The URL (web) or deep link (native) may select the theme with
// ?profile= (or ?theme=, the walker's name for it), &scheme=, &brand=;
// the default profile is used otherwise.
import { Stack, useGlobalSearchParams } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LibProvider, useLib } from '../../../src/app-core/contexts/lib-context.js';
import navigationAdapter from '../adapters/navigation.js';
import fontsAdapter from '../adapters/fonts.js';
import Autopilot from '../../../src/screens/walk/Autopilot.js';

// Build-time flag (Expo inlines EXPO_PUBLIC_* at bundle time): when the
// native gate builds with EXPO_PUBLIC_WALK_SERVER set, the app boots into the
// autopilot instead of the router and takes its walk commands from that server
const WALK_SERVER = process.env.EXPO_PUBLIC_WALK_SERVER || null;

// Stable adapter set: LibProvider memoizes the container on this reference
const ADAPTERS = { Navigation: navigationAdapter, Fonts: fontsAdapter };


// The native frame: the device's safe area and status bar themed to the
// selected scheme, so no route's content slides under the notch and the
// status text reads against the page. Renders below the ThemeProvider -
// under the autopilot's waiting state there is no theme and the frame
// draws a plain safe area
function NativeFrame (props) {

  const Lib = useLib();
  const React = Lib.React;
  const ctx = Lib.ThemeContext.useThemeController();
  const template = ctx ? Lib.Themes.profiles[ctx.profileName].schemes[ctx.schemeName] : null;

  return React.createElement(SafeAreaView, {
    edges: ['top', 'right', 'bottom', 'left'],
    style: { flex: 1, backgroundColor: ctx ? ctx.theme['color.background'] : undefined }
  },
  React.createElement(StatusBar, { style: template && template.polarity === 'dark' ? 'light' : 'dark' }),
  props.children);

}


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

  // A gate build walks under the server's command; nothing else renders.
  // The frame is injected so it can sit inside the autopilot's own
  // command ThemeProvider
  if (WALK_SERVER) {
    return <Autopilot server={WALK_SERVER} Frame={NativeFrame} />;
  }

  // Provide the selected theme to every route, inside the native frame;
  // the Stack itself stays transparent and the themed Scene draws the page
  const { ThemeProvider } = Lib.ThemeContext;
  return (
    <ThemeProvider profile={params.profile || params.theme || params.template} scheme={params.scheme} brand={params.brand} form={params.form} adaptive={params.adaptive} textScale={params.textScale} dir={params.dir}>
      <NativeFrame>
        {Lib.Navigation.NavigationHooks ? <Lib.Navigation.NavigationHooks /> : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      </NativeFrame>
    </ThemeProvider>
  );

}


export default function RootLayout () {
  return (
    <SafeAreaProvider>
      <LibProvider adapters={ADAPTERS}>
        <Boot />
      </LibProvider>
    </SafeAreaProvider>
  );
}
