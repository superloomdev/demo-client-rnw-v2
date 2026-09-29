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

    // Init the three selections
    const profiles = Lib.Themes.profiles;
    const [profileName, setProfileName] = React.useState(props.profile || Lib.Config.theme.DEFAULT_PROFILE);
    const [schemeName, setSchemeName] = React.useState(props.scheme || null);
    const [brandName, setBrandName] = React.useState(props.brand || null);

    // Follow the props: a host that re-renders the provider with a new
    // selection (a deep link reaching a running app, a URL change) re-derives
    // the theme. The controller's setters still switch it in between.
    React.useEffect(function () {
      setProfileName(props.profile || Lib.Config.theme.DEFAULT_PROFILE);
      setSchemeName(props.scheme || null);
      setBrandName(props.brand || null);
    }, [props.profile, props.scheme, props.brand]);

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

    // The brand is the only layer; memoized so the extension sees a stable reference
    const layers = React.useMemo(function () {
      const brand = brandName ? Lib.Themes.brands[brandName] : null;
      return brand ? [brand] : [];
    }, [brandName, epoch]);

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

    // Transform seam: build the component system from the derived theme
    const transform = React.useCallback(function (built) {
      const result = buildSystem(Lib, built, rederive, Lib.Config.theme.DEFAULT_BREAKPOINT);
      return {
        Registry: result.Registry,
        theme: result.tokens,
        fallbacks: result.fallbacks,
        profileName: profileName,
        schemeName: resolvedScheme,
        brandName: brandName,
        updateProfile: updateProfile,
        updateScheme: updateScheme,
        updateBrand: updateBrand
      };
    }, [rederive, profileName, resolvedScheme, brandName, updateProfile, updateScheme, updateBrand]);

    // Render the extension's provider with the app's template, layers and seam
    return React.createElement(Ext.ThemeProvider, {
      template: template,
      layers: layers,
      platform: THEME_PLATFORM,
      transform: transform
    }, props.children);

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
