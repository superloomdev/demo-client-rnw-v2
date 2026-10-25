// Info: Sample screen - settings. Every control is a built component and
// the appearance section is bound to the shared explorer state, so the
// screen edits the same selection the URL carries. A 600 ms skeleton
// prelude shows the loading state, and the danger-zone delete goes
// through the built Modal.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';


export default function Settings () {

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const ctx = Lib.ThemeContext.useThemeController();
  const R = ctx.Registry;

  // The loading prelude
  const [ready, setReady] = React.useState(false);
  React.useEffect(function () {
    const timer = setTimeout(function () {
      setReady(true);
    }, 600);
    return function () {
      clearTimeout(timer);
    };
  }, []);

  // The dialog and the local notification selections
  const [confirming, setConfirming] = React.useState(false);
  const [digest, setDigest] = React.useState(true);
  const [mentions, setMentions] = React.useState(true);
  const [product, setProduct] = React.useState(false);
  const [digestHour, setDigestHour] = React.useState(9);

  // The explorer's choices as control items
  const profiles = Object.keys(Lib.Themes.profiles).map(function (name) {
    return { value: name, label: name };
  });
  const schemes = Object.keys(Lib.Themes.profiles[ctx.profileName].schemes).map(function (name) {
    return { value: name, label: name };
  });
  const brands = Object.keys(Lib.Themes.profiles[ctx.profileName].brands || {}).map(function (name) {
    return { value: name, label: name };
  });

  if (!ready) {
    return React.createElement(Scene, { testID: 'sample-settings' },
      React.createElement(Lib.ReactNative.ScrollView, { contentContainerStyle: { padding: 24, gap: 16 } },
        React.createElement(R.SkeletonText, { heading: true, paragraph: true, testID: 'sample-settings-skeleton' })));
  }

  // Render the bound and the local controls inside the route's own scene
  return React.createElement(Scene, { testID: 'sample-settings' },
    React.createElement(Lib.ReactNative.ScrollView, { testID: 'sample-settings-loaded', contentContainerStyle: { padding: 24, gap: 16 } },
      React.createElement(R.Heading, { children: 'Settings' }),
      React.createElement(R.Section, { level: 2 },
        React.createElement(R.Heading, { children: 'Appearance' }),
        React.createElement(R.Select, {
          label: 'Template', value: ctx.profileName, items: profiles,
          onChange: function (value) {
            ctx.updateProfile(value);
          }
        }),
        React.createElement(R.RadioButtonGroup, {
          legendText: 'Scheme', value: ctx.schemeName, items: schemes,
          onChange: function (value) {
            ctx.updateScheme(value);
          }
        }),
        React.createElement(R.Dropdown, {
          label: 'Brand', items: brands, value: ctx.brandName || undefined, placeholder: 'none',
          onChange: function (value) {
            ctx.updateBrand(value || null);
          }
        }),
        React.createElement(R.Slider, {
          label: 'Text scale', min: 1, max: 2, step: 0.1, value: ctx.textScale,
          onChange: function (value) {
            ctx.updateTextScale(value);
          }
        }),
        React.createElement(R.Toggle, {
          label: 'Fixed layout', checked: ctx.adaptive === 'fixed',
          onChange: function (next) {
            ctx.updateAdaptive(next ? 'fixed' : 'auto');
          }
        }),
        React.createElement(R.Toggle, {
          label: 'Right-to-left', checked: ctx.dir === 'rtl',
          onChange: function (next) {
            ctx.updateDir(next ? 'rtl' : 'ltr');
          }
        })),
      React.createElement(R.Divider),
      React.createElement(R.Section, { level: 2 },
        React.createElement(R.Heading, { children: 'Notifications' }),
        React.createElement(R.Toggle, { label: 'Daily digest', checked: digest, onChange: setDigest }),
        React.createElement(R.Toggle, { label: 'Mentions', checked: mentions, onChange: setMentions }),
        React.createElement(R.Toggle, { label: 'Product news', checked: product, onChange: setProduct }),
        React.createElement(R.NumberInput, {
          label: 'Digest hour', min: 0, max: 23, value: digestHour,
          onChange: function (value) {
            if (typeof value === 'number') {
              setDigestHour(value);
            }
          }
        })),
      React.createElement(R.Section, { level: 2 },
        React.createElement(R.Heading, { children: 'Danger zone' }),
        React.createElement(R.DangerButton, {
          children: 'Delete account',
          onPress: function () {
            setConfirming(true);
          }
        })),
      React.createElement(R.Modal, {
        open: confirming,
        title: 'Delete account',
        alert: true,
        onClose: function () {
          setConfirming(false);
        },
        actions: [
          { label: 'Cancel', onPress: function () {
            setConfirming(false);
          } },
          { label: 'Delete', danger: true, onPress: function () {
            setConfirming(false);
          } }
        ],
        children: 'This permanently removes the account and its records.'
      })));

}
