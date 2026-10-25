// Info: Theme context - the runtime-theming hub for the host app. Wraps the
// themer-ext-react extension with the app's three choices:
//
//   1. a profile (one template package: default, carbon, material),
//   2. a scheme inside it (a complete token set: light, dark, g90 ...),
//   3. optionally one sparse brand layer on top.
//
// The selected scheme is the template; the brand is the only layer. The
// extension re-derives when either reference changes, and its transform
// seam builds the component system (build-system.js) from the result.
//
// Loader pattern: SINGLETON over the injected Lib. Consumers reach it
// through Lib.ThemeContext.
import { buildSystem, THEME_PLATFORM } from '../../themes/build-system.js';


// Injected dependencies, set by the loader
let Lib;
let React;
let Ext;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader.

@param {Object} shared_libs - Lib container; requires React, ThemerReact,
                              Themes, Fonts, Font, Components, Config

@return {Object} - { ThemeProvider, useThemeController, useComponents }
*********************************************************************/
export default function loader (shared_libs) {

  // Capture the injected dependencies
  Lib = shared_libs;
  React = Lib.React;
  Ext = Lib.ThemerReact;

  // Validate what the provider reads
  for (const name of ['React', 'ThemerReact', 'Themes', 'Fonts', 'Font', 'Components', 'Config']) {
    if (Lib[name] === undefined || Lib[name] === null) {
      throw new TypeError('theme-context: Lib.' + name + ' is required');
    }
  }

  // Return the public interface
  return ThemeContext;

}/////////////////////////// Module-Loader END /////////////////////////////////


/////////////////////////// Public Functions START /////////////////////////////
const ThemeContext = {


  /********************************************************************
  ThemeProvider - holds profile, scheme and brand in state, derives the
  template and layers from them, and builds the component system in the
  extension's transform seam.

  @param {Object} props         - React props
  @param {String} props.profile - default | carbon | material (optional)
  @param {String} props.scheme  - scheme within the profile (optional; first)
  @param {String} props.brand   - a key of Lib.Themes.brands (optional)
  @param {Node}   props.children

  @return {Object} - React element
  *********************************************************************/
  ThemeProvider: function (props) {

    // Init the three selections and the adaptive seam's four inputs
    const profiles = Lib.Themes.profiles;
    const [profileName, setProfileName] = React.useState(props.profile || Lib.Config.theme.DEFAULT_PROFILE);
    const [schemeName, setSchemeName] = React.useState(props.scheme || null);
    const [brandName, setBrandName] = React.useState(props.brand || null);
    const [formName, setFormName] = React.useState(props.form || null);
    const [adaptive, setAdaptive] = React.useState(props.adaptive || 'auto');
    const [textScaleName, setTextScaleName] = React.useState(props.textScale === undefined ? null : Number(props.textScale));
    const [dirName, setDirName] = React.useState(props.dir || 'ltr');

    // Follow the props: a host that re-renders the provider with a new
    // selection (a deep link reaching a running app, a URL change) re-derives
    // the theme. The controller's setters still switch it in between.
    React.useEffect(function () {
      setProfileName(props.profile || Lib.Config.theme.DEFAULT_PROFILE);
      setSchemeName(props.scheme || null);
      setBrandName(props.brand || null);
      setFormName(props.form || null);
      setAdaptive(props.adaptive || 'auto');
      setTextScaleName(props.textScale === undefined ? null : Number(props.textScale));
      setDirName(props.dir || 'ltr');
    }, [props.profile, props.scheme, props.brand, props.form, props.adaptive, props.textScale, props.dir]);

    // Init the re-derive epoch an async font load bumps
    const [epoch, setEpoch] = React.useState(0);
    const rederive = React.useCallback(function () {
      setEpoch(function (n) {
        return n + 1;
      });
    }, []);

    // Resolve the profile and scheme; an unknown name is a programmer error
    const profile = profiles[profileName];
    if (profile === undefined) {
      throw new TypeError('theme-context: unknown profile "' + profileName + '"; one of ' + Object.keys(profiles).join(', '));
    }
    const resolvedScheme = schemeName || Object.keys(profile.schemes)[0];
    const template = profile.schemes[resolvedScheme];
    if (template === undefined) {
      throw new TypeError('theme-context: profile "' + profileName + '" has no scheme "' + resolvedScheme + '"');
    }

    // Resolve the platform seam once: Platform.OS on every host (a desktop
    // hint maps to macos/windows through Config.desktop when a host sets it)
    const platform = (Lib.Config.desktop && Lib.Config.desktop.platform) || Lib.ReactNative.Platform.OS;

    // Resolve the form class: an explicit selection wins; otherwise the
    // window's width decides, re-resolved on every resize
    const windowWidth = (Lib.ReactNative.useWindowDimensions || function () {
      return { width: Lib.ReactNative.Dimensions.get('window').width };
    })().width;
    const resolvedForm = formName || Lib.Components.resolveForm(windowWidth);

    // Resolve the text scale: an explicit selection wins; otherwise the
    // host's own scale applies (OS font scale on native, root font size on web)
    const hostScale = platform === 'web'
      ? (typeof document !== 'undefined' && document.documentElement ? parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) / 16 : 1)
      : (Lib.ReactNative.PixelRatio && Lib.ReactNative.PixelRatio.getFontScale ? Lib.ReactNative.PixelRatio.getFontScale() : 1);
    const resolvedTextScale = textScaleName === null ? hostScale : textScaleName;

    // Diagnostics are collected per session and reach the walker report;
    // each record also lands in the debug log at debug level
    const diagnosticsRef = React.useRef([]);
    const onDiagnostic = React.useCallback(function (record) {
      diagnosticsRef.current = diagnosticsRef.current.concat([record]);
      Lib.Debug.debug('theme diagnostic: ' + JSON.stringify(record));
    }, []);

    // Apply the direction to the root it controls: the dir attribute on the
    // web document (react-native-web's locale reading follows it); a native
    // host re-reads I18nManager on restart, so the controller just exposes it
    React.useEffect(function () {
      if (platform === 'web' && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.dir = dirName;
      }
    }, [platform, dirName]);

    // The brand is the only layer, picked by the built scheme's polarity and
    // drawn from the profile's own brand set (the template's plus the demo's)
    const polarity = template.polarity === 'dark' ? 'dark' : 'light';
    const layers = React.useMemo(function () {
      const brand = brandName ? (profile.brands || {})[brandName] : null;
      if (brandName !== null && brandName !== undefined && brand === undefined) {
        throw new TypeError('theme-context: profile "' + profileName + '" has no brand "' + brandName + '"');
      }
      return brand ? [brand[polarity] || brand] : [];
    }, [brandName, profileName, resolvedScheme, polarity, epoch]);

    // The engine options: the resolved form and platform pick the template's
    // variants; `adaptive: 'fixed'` ignores them entirely
    const options = React.useMemo(function () {
      return {
        variant: { form: resolvedForm, platform: platform },
        adaptive: adaptive
      };
    }, [resolvedForm, platform, adaptive]);

    // Stable setters for the controller
    const updateProfile = React.useCallback(function (name) {
      setProfileName(name);
      setSchemeName(null);
    }, []);
    const updateScheme = React.useCallback(function (name) {
      setSchemeName(name);
    }, []);
    const updateBrand = React.useCallback(function (name) {
      setBrandName(name || null);
    }, []);
    const updateForm = React.useCallback(function (name) {
      setFormName(name || null);
    }, []);
    const updateAdaptive = React.useCallback(function (name) {
      setAdaptive(name || 'auto');
    }, []);
    const updateTextScale = React.useCallback(function (value) {
      setTextScaleName(value === null || value === undefined ? null : Number(value));
    }, []);
    const updateDir = React.useCallback(function (name) {
      setDirName(name || 'ltr');
    }, []);

    // Transform seam: build the component system from the derived theme
    const transform = React.useCallback(function (built) {
      const result = buildSystem(Lib, built, rederive, Lib.Config.theme.DEFAULT_BREAKPOINT, {
        textScale: resolvedTextScale,
        onDiagnostic: onDiagnostic
      });
      return {
        Registry: result.Registry,
        theme: result.tokens,
        fallbacks: result.fallbacks,
        profileName: profileName,
        schemeName: resolvedScheme,
        brandName: brandName,
        form: formName,
        resolvedForm: resolvedForm,
        adaptive: adaptive,
        textScale: resolvedTextScale,
        dir: dirName,
        platform: platform,
        diagnostics: diagnosticsRef.current,
        updateProfile: updateProfile,
        updateScheme: updateScheme,
        updateBrand: updateBrand,
        updateForm: updateForm,
        updateAdaptive: updateAdaptive,
        updateTextScale: updateTextScale,
        updateDir: updateDir
      };
    }, [rederive, profileName, resolvedScheme, brandName, formName, resolvedForm, adaptive, resolvedTextScale, dirName, platform, onDiagnostic, updateProfile, updateScheme, updateBrand, updateForm, updateAdaptive, updateTextScale, updateDir]);

    // Render the extension's provider with the app's template, layers and seam
    return React.createElement(Ext.ThemeProvider, {
      template: template,
      layers: layers,
      platform: THEME_PLATFORM,
      options: options,
      transform: transform
    }, React.createElement(RootHost, null, props.children));

  },


  /********************************************************************
  Hook: the controller - { Registry, theme, fallbacks, profileName,
  schemeName, brandName, updateProfile, updateScheme, updateBrand }.

  @return {Object|null} - context value, or null outside a provider
  *********************************************************************/
  useThemeController: function () {

    // Return the extension's context value, which carries the seam's fields
    return Ext.useThemeController();

  },


  /********************************************************************
  Hook: the component registry built for the current theme.

  @return {Object|null} - the registry, or null outside a provider
  *********************************************************************/
  useComponents: function () {

    // Read the controller
    const ctx = Ext.useThemeController();

    // Return the registry, or null outside a provider
    return ctx ? ctx.Registry : null;

  }


};/////////////////////////// Public Functions END //////////////////////////////


/********************************************************************
Root overlay host. Sits inside the extension's provider so it can read
the built registry: when it carries an OverlayHost, the whole app is its
child and every overlay renders its layers through the host, on every
platform. An older registry without the component passes children
through untouched.

@param {Object} props - React props

@return {Object} - React element
*********************************************************************/
function RootHost (props) {

  // Read the controller; a registry with an OverlayHost mounts it at the root
  const ctx = Ext.useThemeController();
  const Host = ctx && ctx.Registry ? ctx.Registry.OverlayHost : undefined;

  return Host === undefined
    ? props.children
    : React.createElement(Host, null, props.children);

}
