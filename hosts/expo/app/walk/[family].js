// Info: /walk/<Family> - the walker over one family, for per-family
// simulator screenshots: nimbus://walk/<Family>?theme=<t>.
import { useLocalSearchParams } from 'expo-router';
import Walker from '../../../../src/screens/walk/Walker.js';


export default function WalkFamilyRoute () {

  // Read the family and the optional report URL
  const params = useLocalSearchParams();

  // Render the shared walker for that family
  return <Walker family={params.family} report={params.report} />;

}
