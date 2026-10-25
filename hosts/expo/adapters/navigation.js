// Info: Expo adapter for the Navigation slot. Maps the navigation contract onto
// expo-router primitives. Shared source never imports expo-router directly.
import { Link, Redirect, useRouter } from 'expo-router';


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Merge one or more query parameters into the current route without a
  // navigation: expo-router's setParams keeps every explorer combination
  // addressable. A null or empty value removes the key.
  // `useNavigation` is not used: setParams only needs the router object,
  // which React supplies through the component tree. The adapter cannot call
  // hooks itself, so it hands out a stable callback bound lazily on call.
  let router = null;

  function setParams (updates) {
    if (router === null) {
      return;
    }
    router.setParams(updates);
  }

  // Mounted once under the layout so the router reaches this closure
  function NavigationHooks () {
    router = useRouter();
    return null;
  }

  // Ready-to-use navigation surface; the loader assigns it to Lib.Navigation
  return {
    Link: Link,
    Redirect: Redirect,
    setParams: setParams,
    NavigationHooks: NavigationHooks
  };

};
