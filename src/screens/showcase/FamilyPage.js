// Info: One family's page: every sample state of every component in the
// family, rendered from the library's catalog under the current theme, one
// guarded cell per state. The web e2e gates and screenshots read this page.
import { useLib } from '../../app-core/contexts/lib-context.js';
import createSafeCell from './SafeCell.js';


/********************************************************************
Family page.

@param {Object} props        - React props
@param {String} props.family - Roster family name

@return {Object} - React element
*********************************************************************/
export default function FamilyPage (props) {

  // Init the container, the theme controller and the cell component once
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text, ScrollView } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();
  const SafeCell = React.useMemo(function () {
    return createSafeCell(Lib);
  }, [Lib]);

  // Select this family's components
  const entries = Lib.Components.catalog.filter(function (entry) {
    return entry.family === props.family;
  });

  // An unknown family renders a plain message, not an empty page
  if (Lib.Utils.isEmptyArray(entries)) {
    return React.createElement(Text, { testID: 'family-missing' }, 'No family "' + props.family + '" in the catalog');
  }

  // Render one section per component, one cell per sample state
  return React.createElement(ScrollView, {
    testID: 'family-' + props.family,
    dataSet: { family: props.family, profile: ctx.profileName, scheme: ctx.schemeName, brand: ctx.brandName || '' },
    contentContainerStyle: { padding: 24, gap: 16 }
  },
  React.createElement(Text, { style: { fontSize: 20, fontWeight: '600' } }, props.family),
  entries.map(function (entry) {
    return React.createElement(View, { key: entry.name, style: { gap: 8 } },
      React.createElement(Text, { style: { fontSize: 16 } }, entry.name + ' - ' + entry.tier + ', ' + entry.platform),
      React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } },
        entry.sample.map(function (state) {
          return React.createElement(SafeCell, { key: state.label, Component: ctx.Registry[entry.name], entry: entry, state: state });
        })));
  }));

}
