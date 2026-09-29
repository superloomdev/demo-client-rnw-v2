// Info: Bootstrap screen. Proves the whole chain on every host: the loader
// built Lib, the theme context derived the selected profile, the component
// system was created from it, and a library component rendered. The
// showcase (Step 4.2) replaces this as the demo's main surface.
import { useLib } from '../../app-core/contexts/lib-context.js';


export default function Home () {

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();

  // Read what the system was built with
  const Registry = ctx.Registry;
  const names = Object.keys(Registry);
  const Icon = Registry.Icon;

  // Render the proof line
  return React.createElement(View, { testID: 'home', style: { padding: 24, gap: 12 } },
    React.createElement(Text, { testID: 'home-profile' }, 'Profile: ' + ctx.profileName + ' / ' + ctx.schemeName),
    React.createElement(Text, { testID: 'home-count' }, 'Components: ' + names.length),
    React.createElement(Icon, { name: 'checkmark', accessibilityLabel: 'System built', testID: 'home-icon' }));

}
