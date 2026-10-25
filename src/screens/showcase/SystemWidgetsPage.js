// Info: /showcase/system-widgets - the system-widget seam made visible. On
// the web the Toggle always draws the theme's switch (no browser can draw
// the operating system's). On native, when the template's platform variant
// pins `anatomy.toggle_widget: system`, the same Toggle mounts the OS switch
// through the host's adapter; this page renders it beside the theme-drawn
// switch, built through a second system with `adaptive: 'fixed'` so its
// platform variant is ignored.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';
import { buildSystem } from '../../themes/build-system.js';


/********************************************************************
System widgets page.

@param {Object} props - React props (none used)

@return {Object} - React element
*********************************************************************/
export default function SystemWidgetsPage (props) { // eslint-disable-line no-unused-vars

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text, ScrollView } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();
  const Toggle = ctx.Registry.Toggle;

  // Init a switch state both renders share
  const [checked, setChecked] = React.useState(true);

  // On native, derive the drawn build: the same template and brand layer
  // with the variants ignored. The engine caches the base, so this rebuild
  // is cheap.
  const drawnToggle = React.useMemo(function () {
    if (ctx.platform === 'web') {
      return null;
    }
    const profile = Lib.Themes.profiles[ctx.profileName];
    const template = profile.schemes[ctx.schemeName];
    const brand = ctx.brandName ? (profile.brands || {})[ctx.brandName] : null;
    const polarity = template.polarity === 'dark' ? 'dark' : 'light';
    const built = Lib.Themer.buildTheme(template, brand ? [brand[polarity]] : [], 'native', {
      adaptive: 'fixed'
    });
    const system = buildSystem(Lib, built, null, Lib.Config.theme.DEFAULT_BREAKPOINT, { textScale: ctx.textScale });
    return system.Registry.Toggle;
  }, [ctx.platform, ctx.profileName, ctx.schemeName, ctx.brandName, ctx.textScale]);

  // Init the note text for the current platform
  const note = ctx.platform === 'web'
    ? 'The web always draws the theme\'s switch; the operating system\'s appears in the Expo app under platform: ios | android.'
    : 'Left: the theme\'s drawn switch (adaptive fixed). Right: the operating system\'s switch through the host adapter, when the platform variant selects it.';

  // Render the page inside the route's own scene
  return React.createElement(Scene, null,
    React.createElement(ScrollView, {
      testID: 'system-widgets',
      contentContainerStyle: { padding: 24, gap: 16 }
    },
    React.createElement(Text, { testID: 'system-widgets-title', style: { fontSize: 20, fontWeight: '600', color: ctx.theme['color.text_primary'] } }, 'System widgets'),
    React.createElement(Text, { testID: 'system-widgets-note', style: { fontSize: 14, color: ctx.theme['color.text_secondary'] } }, note),
    React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 24 } },
      drawnToggle === null ? null : React.createElement(drawnToggle, {
        testID: 'system-widgets-drawn-toggle', label: 'drawn', checked: checked,
        onChange: setChecked
      }),
      React.createElement(Toggle, {
        testID: 'system-widgets-toggle', label: ctx.platform === 'web' ? 'enabled' : 'system', checked: checked,
        onChange: setChecked
      }))));

}
