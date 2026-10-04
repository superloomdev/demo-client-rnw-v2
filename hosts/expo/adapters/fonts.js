// Info: Expo adapter for the Fonts slot. Supplies the platform font loader
// extension and the host's font asset manifest. Every Expo-only font package
// is imported here and nowhere else. The @expo-google-fonts packages have no
// default export, so each face is a named import.
import FontExtExpo from '@superloomdev/js-client-helper-font-ext-expo';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold
} from '@expo-google-fonts/ibm-plex-sans';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold
} from '@expo-google-fonts/roboto';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { RobotoMono_400Regular } from '@expo-google-fonts/roboto-mono';


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // The platform loader extension; needs Font, Utils and Debug off the container
  const adapter = FontExtExpo(Lib, {});

  // Host-owned asset manifest; family names must match what the themes name
  const manifest = {
    'IBM Plex Sans': {
      styles: {
        normal: {
          asset: IBMPlexSans_400Regular,
          weight: '400',
          style: 'normal'
        },
        semibold: {
          asset: IBMPlexSans_600SemiBold,
          weight: '600',
          style: 'normal'
        },
        bold: {
          asset: IBMPlexSans_700Bold,
          weight: '700',
          style: 'normal'
        }
      }
    },
    'IBM Plex Mono': {
      styles: {
        normal: {
          asset: IBMPlexMono_400Regular,
          weight: '400',
          style: 'normal'
        }
      }
    },
    'Roboto Mono': {
      styles: {
        normal: {
          asset: RobotoMono_400Regular,
          weight: '400',
          style: 'normal'
        }
      }
    },
    'Roboto': {
      styles: {
        normal: {
          asset: Roboto_400Regular,
          weight: '400',
          style: 'normal'
        },
        medium: {
          asset: Roboto_500Medium,
          weight: '500',
          style: 'normal'
        },
        bold: {
          asset: Roboto_700Bold,
          weight: '700',
          style: 'normal'
        }
      }
    }
  };

  // Return the loader and the manifest
  return {
    adapter: adapter,
    manifest: manifest
  };

};
