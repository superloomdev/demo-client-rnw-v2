// Info: /showcase/<Family> - one family's page from shared source.
import { useLocalSearchParams } from 'expo-router';
import FamilyPage from '../../../../src/screens/showcase/FamilyPage.js';


export default function FamilyRoute () {

  // Read the family from the route
  const params = useLocalSearchParams();

  // Render the shared page
  return <FamilyPage family={params.family} />;

}
