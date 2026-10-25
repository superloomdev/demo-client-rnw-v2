// Info: ExplorerBar: the theme explorer's control strip, drawn at the top of
// every scene from the library's own components. One Dropdown per theme
// parameter (template, scheme, brand, form class, text scale) and one Toggle
// per boolean (adaptive auto/fixed, direction ltr/rtl). Changing a control
// updates the theme controller's state and merges the value into the URL, so
// every combination stays addressable.
import { useLib } from '../../app-core/contexts/lib-context.js';


// The selectable text scales; the host's own scale applies at 'host'
const TEXT_SCALES = ['1', '1.3', '2'];


/********************************************************************
ExplorerBar - the explorer's control strip.

@param {Object} props - React props (none used)

@return {Object} - React element
*********************************************************************/
export default function ExplorerBar (props) { // eslint-disable-line no-unused-vars

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { View } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();
  const Registry = ctx.Registry;

  // Init the option lists from the live theme data
  const profiles = Lib.Themes.profiles;
  const profile = profiles[ctx.profileName];
  const templates = Object.keys(profiles).map(function (name) {
    return { value: name, label: name };
  });
  const schemes = Object.keys(profile.schemes).map(function (name) {
    return { value: name, label: name };
  });
  const brands = [{ value: '', label: 'none' }].concat(Object.keys(profile.brands || {}).map(function (name) {
    return { value: name, label: name };
  }));
  const forms = [{ value: '', label: 'auto' }].concat(Lib.Components.FORM_CLASSES.map(function (name) {
    return { value: name, label: name };
  }));
  const scales = TEXT_SCALES.map(function (value) {
    return { value: value, label: value };
  });

  // Apply one control's change: theme state first, the URL second
  const apply = function (param, setter) {
    return function (value) {
      setter(value || null);
      if (Lib.Navigation.setParams) {
        Lib.Navigation.setParams({ [param === 'template' ? 'profile' : param]: value || null });
      }
    };
  };

  // Init the shared row style
  const rowStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderColor: ctx.theme['color.border_subtle_00'],
    backgroundColor: ctx.theme['color.layer_01']
  };

  // Render the strip: one control per explorer parameter
  return React.createElement(View, { testID: 'explorer', style: rowStyle },
    React.createElement(Registry.Dropdown, {
      testID: 'explorer-template', label: 'template', size: 'sm',
      items: templates, value: ctx.profileName,
      onChange: apply('template', ctx.updateProfile)
    }),
    React.createElement(Registry.Dropdown, {
      testID: 'explorer-scheme', label: 'scheme', size: 'sm',
      items: schemes, value: ctx.schemeName,
      onChange: apply('scheme', ctx.updateScheme)
    }),
    React.createElement(Registry.Dropdown, {
      testID: 'explorer-brand', label: 'brand', size: 'sm',
      items: brands, value: ctx.brandName || '',
      onChange: apply('brand', ctx.updateBrand)
    }),
    React.createElement(Registry.Dropdown, {
      testID: 'explorer-form', label: 'form', size: 'sm',
      items: forms, value: ctx.form || '',
      onChange: apply('form', ctx.updateForm)
    }),
    React.createElement(Registry.Dropdown, {
      testID: 'explorer-textScale', label: 'textScale', size: 'sm',
      items: scales, value: TEXT_SCALES.indexOf(String(ctx.textScale)) === -1 ? '' : String(ctx.textScale),
      onChange: apply('textScale', ctx.updateTextScale)
    }),
    React.createElement(Registry.Toggle, {
      testID: 'explorer-adaptive', label: 'adaptive fixed', size: 'sm',
      checked: ctx.adaptive === 'fixed',
      onChange: function (checked) {
        const value = checked ? 'fixed' : 'auto';
        ctx.updateAdaptive(value);
        if (Lib.Navigation.setParams) {
          Lib.Navigation.setParams({ adaptive: value === 'auto' ? null : value });
        }
      }
    }),
    React.createElement(Registry.Toggle, {
      testID: 'explorer-dir', label: 'RTL', size: 'sm',
      checked: ctx.dir === 'rtl',
      onChange: function (checked) {
        const value = checked ? 'rtl' : 'ltr';
        ctx.updateDir(value);
        if (Lib.Navigation.setParams) {
          Lib.Navigation.setParams({ dir: value === 'ltr' ? null : value });
        }
      }
    }));

}
