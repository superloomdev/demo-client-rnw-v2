// Info: Expo adapter for the Navigation slot. Maps the navigation contract onto
// expo-router primitives. Shared source never imports expo-router directly.
import { Link, Redirect } from 'expo-router';


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Ready-to-use navigation surface; the loader assigns it to Lib.Navigation
  return {
    Link: Link,
    Redirect: Redirect
  };

};
