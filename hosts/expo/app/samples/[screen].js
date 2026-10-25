// Info: /samples/<screen> - one sample screen from shared source.
import { useLocalSearchParams } from 'expo-router';
import SignIn from '../../../../src/screens/samples/SignIn.js';
import Settings from '../../../../src/screens/samples/Settings.js';
import Records from '../../../../src/screens/samples/Records.js';

const SCREENS = {
  'sign-in': SignIn,
  'settings': Settings,
  'records': Records
};


export default function SampleRoute () {

  // Read the screen name from the route
  const params = useLocalSearchParams();
  const Screen = SCREENS[params.screen] || SignIn;

  // Render the shared page
  return <Screen />;

}
