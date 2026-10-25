// Info: One family's page: every roster row of the family in roster
// order, built rows rendered from the catalog as sample-state grids and
// pending rows as to-do cards with the milestone they are planned for.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';
import createSafeCell from './SafeCell.js';
import { CELL_CHROME } from './cell-chrome.js';
import { getRoster } from './catalog.js';
import { MILESTONES } from './planned-rows.js';


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
  const R = ctx.Registry;
  const SafeCell = React.useMemo(function () {
    return createSafeCell(Lib);
  }, [Lib]);

  // Select this family's roster group
  const group = getRoster(Lib.Components.catalog).find(function (g) {
    return g.family === props.family;
  });

  // An unknown family renders a plain message, not an empty page
  if (group === undefined) {
    return React.createElement(Scene, null,
      React.createElement(Text, { testID: 'family-missing', style: { color: ctx.theme['color.text_primary'] } },
        'No family "' + props.family + '" in the roster'));
  }

  // Render one entry per roster row, inside the route's own scene
  return React.createElement(Scene, null,
    React.createElement(ScrollView, {
      testID: 'family-' + props.family,
      dataSet: { family: props.family, profile: ctx.profileName, scheme: ctx.schemeName, brand: ctx.brandName || '', form: ctx.resolvedForm, adaptive: ctx.adaptive, textScale: String(ctx.textScale), dir: ctx.dir },
      contentContainerStyle: { padding: 24, gap: 16 }
    },
    React.createElement(R.Heading, { testID: 'family-title', children: props.family + ' ' + group.built + '/' + group.total }),
    group.rows.map(function (row) {
      if (row.entry) {
        return React.createElement(View, { key: row.name, style: { gap: 8 } },
          React.createElement(Text, { testID: 'component-title-' + row.name, style: { fontSize: 16, color: ctx.theme['color.text_primary'] } }, row.name + ' - ' + row.row.tier + ', ' + row.row.platform.support),
          React.createElement(EntryGrid, { Lib: Lib, ctx: ctx, entry: row.entry, SafeCell: SafeCell }));
      }
      return React.createElement(ToDoCard, { key: row.name, row: row, Lib: Lib, ctx: ctx });
    })));

}


/********************************************************************
One pending roster row's to-do card: the milestone tag, the tier and
platform facts, the twins, and the description, all through built
components.

@param {Object} props - { row, Lib, ctx }

@return {Object} - React element
*********************************************************************/
function ToDoCard (props) {

  const Lib = props.Lib;
  const React = Lib.React;
  const row = props.row;
  const R = props.ctx.Registry;

  // The twins line: omit a 'none'
  const facts = [row.row.tier, row.row.platform && row.row.platform.support ? row.row.platform.support : 'all'];
  if (row.row.carbon_twin && row.row.carbon_twin !== 'none') {
    facts.push('carbon ' + row.row.carbon_twin);
  }
  if (row.row.material_twin && row.row.material_twin !== 'none') {
    facts.push('material ' + row.row.material_twin);
  }
  const milestone = MILESTONES[row.row.family];

  return React.createElement(R.Layer, { testID: 'todo-' + row.name },
    React.createElement(R.HStack, null,
      React.createElement(R.Heading, { children: row.name }),
      React.createElement(R.Tag, { children: 'to-do' }),
      milestone ? React.createElement(R.Tag, { children: milestone }) : null),
    React.createElement(R.Text, { children: facts.join(' · ') }),
    React.createElement(R.Text, { children: row.row.description }));

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
      Registry: props.ctx.Registry,
      Host: props.ctx.Registry.OverlayHost,
      captionColor: props.ctx.theme['color.text_secondary'],
      borderColor: props.ctx.theme['color.border_subtle_01'],
      room: gridWidth - CELL_CHROME
    });
  }) : null);

}
