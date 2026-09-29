// Info: /walk - the walker over every family. Reached on native by deep link
// nimbus://walk?theme=<t>&report=<url>.
import { useLocalSearchParams } from 'expo-router';
import Walker from '../../../../src/screens/walk/Walker.js';


export default function WalkRoute () {

  // Read the report URL from the link
  const params = useLocalSearchParams();

  // Render the shared walker
  return <Walker report={params.report} />;

}
