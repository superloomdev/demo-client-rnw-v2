// Info: The walker: renders every catalog component in every sample state
// (or one family's) under the current theme, each in an error boundary,
// measures each cell with onLayout, and once every cell has reported sends
// one JSON report to `report` (a URL) by POST. The native gate reaches it by
// deep link (nimbus://walk?theme=<t>&report=<url>) and screenshots it per
// family (nimbus://walk/<Family>?theme=<t>). On web the report is also left
// on `globalThis.__walk` for the e2e tests.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';
import createSafeCell from '../showcase/SafeCell.js';
import { CELL_CHROME } from '../showcase/cell-chrome.js';
import { buildReport } from './report.js';


// The quiet period after the last layout change before the report is sent
export const SETTLE_MS = 500;

// How often the walker checks for the quiet period
export const POLL_MS = 100;

// The longest a test waits for a report that needs no correction
export const REPORT_AFTER_MS = 2 * SETTLE_MS + 3 * POLL_MS;


/********************************************************************
Walker screen. A new theme selection or a new walk request (a deep link
reaching a running app) starts a fresh walk: the run is keyed by both, so
its measurements and send status never carry over.

@param {Object} props          - React props
@param {String} [props.family] - Walk one family only
@param {String} [props.report] - URL that receives the report by POST

@return {Object} - React element
*********************************************************************/
export default function Walker (props) {

  // Init the container and the selection the run is keyed by
  const Lib = useLib();
  const React = Lib.React;
  const ctx = Lib.ThemeContext.useThemeController();
  const key = [ctx.profileName, ctx.schemeName, ctx.brandName || '', ctx.resolvedForm || '', ctx.adaptive || '', ctx.textScale || '', ctx.dir || '', props.family || '', props.report || ''].join('|');

  // Render one run per selection and request, inside the route's own scene
  return React.createElement(Scene, { key: key, explorer: false },
    React.createElement(WalkerRun, { family: props.family, report: props.report }));

}


/********************************************************************
One walk under one theme selection.

@param {Object} props - As Walker

@return {Object} - React element
*********************************************************************/
function WalkerRun (props) {

  // Init the container, the theme controller and the cell component
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text, ScrollView } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();
  const SafeCell = React.useMemo(function () {
    return createSafeCell(Lib);
  }, [Lib]);

  // Select the entries to walk
  const entries = React.useMemo(function () {
    return Lib.Components.catalog.filter(function (entry) {
      return !props.family || entry.family === props.family;
    });
  }, [Lib, props.family]);
  // A state the sample marks `cell: false` mounts in the unit gates but
  // not the grids (its drawing escapes a cell by design) - the walker
  // measures the grids
  const expected = entries.reduce(function (sum, entry) {
    return sum + entry.sample.filter(function (state) {
      return state.cell !== false;
    }).length;
  }, 0);

  // Init the measurements, the errors, the grid room and the send status.
  // The room is state, not a ref: the cells render only once it is known,
  // so no cell measures before its room is fixed and the report cannot
  // race a relayout
  const cells = React.useRef({});
  const errors = React.useRef([]);
  const lastLayoutAt = React.useRef(0);
  const count = React.useRef(0);
  const markerAt = React.useRef(0);
  const statusRef = React.useRef('measuring');
  const [gridWidth, setGridWidth] = React.useState(0);
  const [shown, setShown] = React.useState({ measured: 0 });
  const [status, setStatus] = React.useState('measuring');
  const [cycle, setCycle] = React.useState(0);

  // The stable cell handlers read the phase through a ref
  React.useEffect(function () {
    statusRef.current = status;
  }, [status]);

  // Poll for the report condition: a layout event renders nothing, so a
  // poll every POLL_MS reads the refs directly. Once every cell has
  // measured and the layout has gone quiet, a `confirming` commit runs:
  // a cell's own correction (a fluid set stacking from its measured
  // width, an overflow seat unmounting) is a React update queued behind
  // the walk's backlog. The mount, not the commit, is what a late
  // correction waits on - Fabric applies mount transactions on the UI
  // thread in commit order and the ~2000-cell first transaction keeps it
  // busy for seconds - so the confirming commit carries a marker whose own
  // layout event is the UI thread's receipt that transaction mounted. A
  // quiet period that starts at that receipt and sees no layout change
  // can only end on the settled layout; web is one pass, so the quiet
  // periods change nothing there
  React.useEffect(function () {

    if (status !== 'measuring' && status !== 'confirming') {
      return;
    }

    let timer = null;
    const send = function () {

      // Build the report from the measurements
      const report = buildReport({
        ctx: ctx,
        platform: Lib.ReactNative.Platform.OS,
        catalog: entries,
        cells: Object.values(cells.current),
        errors: errors.current,
        family: props.family,
        gridWidth: gridWidth
      });
      globalThis.__walk = report;

      // Without a report URL the walk is done
      if (!props.report) {
        setStatus('done');
        return;
      }

      // POST the report; text/plain avoids a CORS preflight on web
      setStatus('sending');
      fetch(props.report, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(report) })
        .then(function (response) {
          // Read the body so the request completes rather than being abandoned
          return response.text().then(function () {
            setStatus(response.ok ? 'sent' : 'send failed: ' + response.status);
          });
        })
        .catch(function (error) {
          setStatus('send failed: ' + error.message);
        });

    };
    const tick = function () {

      // The status line refreshes only when the count moved
      setShown(function (previous) {
        return previous.measured === count.current ? previous : { measured: count.current };
      });

      // Quiet: every cell reported and nothing moved for SETTLE_MS
      if (status === 'measuring') {
        if (count.current >= expected && Date.now() - lastLayoutAt.current >= SETTLE_MS) {
          markerAt.current = 0;
          setCycle(function (c) {
            return c + 1;
          });
          setStatus('confirming');
          return;
        }
      } else if (markerAt.current > 0 && Date.now() - Math.max(markerAt.current, lastLayoutAt.current) >= SETTLE_MS) {
        send();
        return;
      }

      timer = setTimeout(tick, POLL_MS);

    };
    timer = setTimeout(tick, POLL_MS);
    return function () {
      clearTimeout(timer);
    };

  }, [status, expected]);

  // The grid's own width names the room a cell body gets: a component
  // whose width is capped by its host reports it, never the token's
  const onGridLayout = function (event) {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== gridWidth) {
      setGridWidth(width);
    }
  };

  // Every cell element, once per room and theme: the poll and the phase
  // changes re-render this component, and identical elements let React
  // skip the cells, so a cell's own correction pass is not queued behind
  // every sibling's re-render - a full-catalog walk is ~2000 of them
  const cellElements = React.useMemo(function () {
    if (gridWidth <= 0) {
      return null;
    }
    return entries.flatMap(function (entry) {
      return entry.sample.filter(function (state) {
        return state.cell !== false;
      }).map(function (state) {
        const key = entry.name + '/' + state.label;
        return React.createElement(SafeCell, {
          key: key,
          Component: ctx.Registry[entry.name],
          entry: entry,
          state: state,
          Registry: ctx.Registry,
          Host: ctx.Registry.OverlayHost,
          captionColor: ctx.theme['color.text_secondary'],
          borderColor: ctx.theme['color.border_subtle_01'],
          room: gridWidth - CELL_CHROME,
          onLayout: function (event) {
            const previous = cells.current[key];
            const width = event.nativeEvent.layout.width;
            const height = event.nativeEvent.layout.height;
            cells.current[key] = {
              component: entry.name,
              state: state.label,
              width: width,
              height: height,
              widget: entry.widget === undefined ? null : entry.widget
            };
            if (previous === undefined) {
              count.current = count.current + 1;
            }
            if (previous === undefined || previous.width !== width || previous.height !== height) {
              lastLayoutAt.current = Date.now();
              if (statusRef.current === 'confirming') {
                setStatus(function (s) {
                  return s === 'confirming' ? 'measuring' : s;
                });
              }
            }
          },
          onError: function (message) {
            errors.current.push({ component: entry.name, state: state.label, message: message });
          }
        });
      });
    });
  }, [entries, SafeCell, ctx.Registry, ctx.theme, gridWidth]);

  // Render every cell once the room is known, recording its layout and any error
  return React.createElement(ScrollView, { testID: 'walker', contentContainerStyle: { padding: 16, gap: 12 } },
    React.createElement(Text, { testID: 'walk-status', style: { color: ctx.theme['color.text_primary'] } }, 'walk: ' + status + ' (' + shown.measured + '/' + expected + ')'),
    // The marker's height changes once per cycle, so it lays out once per
    // cycle; its event is the UI thread's receipt for the confirming
    // transaction, after which every queued correction has mounted
    React.createElement(View, {
      testID: 'walk-marker',
      onLayout: function () {
        markerAt.current = Date.now();
      },
      style: { alignSelf: 'stretch', height: 1 + (cycle % 2) }
    }),
    React.createElement(View, { testID: 'walk-grid', onLayout: onGridLayout, style: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } },
      cellElements));

}
