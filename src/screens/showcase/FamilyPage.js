// Info: One family's page: every sample state of every component in the
// family, rendered from the library's catalog under the current theme, one
// guarded cell per state. The web e2e gates and screenshots read this page.
import { useLib } from '../../app-core/contexts/lib-context.js';
import createSafeCell from './SafeCell.js';
import { CELL_CHROME } from './cell-chrome.js';


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
      React.createElement(EntryGrid, { Lib: Lib, ctx: ctx, entry: entry, SafeCell: SafeCell }));
  }));

}


/********************************************************************
One component's grid of cells. The grid holds its own width in state and
the cells render only once it is known: a staged or capped cell never
measures before its room is fixed.

@param {Object} props          - React props
@param {Object} props.Lib      - The container
@param {Object} props.ctx      - The theme controller
@param {Object} props.entry    - Catalog entry
@param {Object} props.SafeCell - The cell component

@return {Object} - React element
*********************************************************************/
function EntryGrid (props) {

  const Lib = props.Lib;
  const React = Lib.React;
  const { View } = Lib.ReactNative;
  const [gridWidth, setGridWidth] = React.useState(0);

  // A state the sample marks `cell: false` mounts in the unit gates
  // but not the grids: its drawing escapes a cell by design
  return React.createElement(View, {
    testID: 'cell-grid',
    onLayout: function (event) {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && width !== gridWidth) {
        setGridWidth(width);
      }
    },
    style: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }
  }, gridWidth > 0 ? props.entry.sample.filter(function (state) {
    return state.cell !== false;
  }).map(function (state) {
    return React.createElement(props.SafeCell, {
      key: state.label,
      Component: props.ctx.Registry[props.entry.name],
      entry: props.entry,
      state: state,
      Host: props.ctx.Registry.OverlayHost,
      room: gridWidth - CELL_CHROME
    });
  }) : null);

}
