// Info: Expo adapter for the Widgets slot on iOS and Android: the OS widgets
// the component library seats through `shared_libs.adapters`.
// - DatePicker (iOS): the community date picker, drawn in the field where
//   the theme's `anatomy.date_picker_widget` asks for the system widget. No
//   template asks for it on Android, whose picker opens a dialog on mount
//   and so could not sit in a field.
// - FilePicker: the document picker; answers `{ name, size, type }` entries,
//   or null when the person cancels.
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';


/********************************************************************
Open the document picker for the library's FileUploader family. The
picker filters by MIME type only; an extension in `accept` is left to the
library's own validation after the pick.

@param {Object}  options          - { accept, multiple }
@param {Array}   options.accept   - Accepted types and extensions
@param {Boolean} options.multiple - Whether several files may be chosen

@return {Promise<Array|null>} - The chosen entries, or null when cancelled
*********************************************************************/
async function FilePicker (options) {

  // Pass the MIME types the accept list names; none means any file
  const accept = Array.isArray(options.accept) ? options.accept : [];
  const types = accept.filter(function (entry) {
    return typeof entry === 'string' && entry.includes('/');
  });

  // Open the picker
  const result = await DocumentPicker.getDocumentAsync({
    multiple: options.multiple === true,
    type: types.length === 0 ? '*/*' : types
  });

  // A cancelled pick chooses nothing
  if (result.canceled === true) {
    return null;
  }

  // Return the entries in the library's shape
  return result.assets.map(function (asset) {
    return { name: asset.name, size: asset.size, type: typeof asset.mimeType === 'string' ? asset.mimeType : '' };
  });

}


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // The system widgets this platform carries
  return Platform.OS === 'ios'
    ? { DatePicker: DateTimePicker, FilePicker: FilePicker }
    : { FilePicker: FilePicker };

}
