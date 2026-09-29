// Info: The walker: renders every catalog component in every sample state
// (or one family's) under the current theme, each in an error boundary,
// measures each cell with onLayout, and once every cell has reported sends
// one JSON report to `report` (a URL) by POST. The native gate reaches it by
// deep link (nimbus://walk?theme=<t>&report=<url>) and screenshots it per
// family (nimbus://walk/<Family>?theme=<t>). On web the report is also left
// on `globalThis.__walk` for the e2e tests.
import { useLib } from '../../app-core/contexts/lib-context.js';
import createSafeCell from '../showcase/SafeCell.js';
import { buildReport } from './report.js';


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
  const key = [ctx.profileName, ctx.schemeName, ctx.brandName || '', props.family || '', props.report || ''].join('|');

  // Render one run per selection and request
  return React.createElement(WalkerRun, { key: key, family: props.family, report: props.report });

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
  const entries = Lib.Components.catalog.filter(function (entry) {
    return !props.family || entry.family === props.family;
  });
  const expected = entries.reduce(function (sum, entry) {
    return sum + entry.sample.length;
  }, 0);

  // Init the measurements, the errors and the send status
  const cells = React.useRef({});
  const errors = React.useRef([]);
  const [measured, setMeasured] = React.useState(0);
  const [status, setStatus] = React.useState('measuring');

  // Send the report once every cell has measured
  React.useEffect(function () {

    // Wait for every cell
    if (measured < expected || status !== 'measuring') {
      return;
    }

    // Build the report from the measurements
    const report = buildReport({
      ctx: ctx,
      platform: Lib.ReactNative.Platform.OS,
      catalog: entries,
      cells: Object.values(cells.current),
      errors: errors.current,
      family: props.family
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

  }, [measured, expected, status]);

  // Render every cell, recording its layout and any error
  return React.createElement(ScrollView, { testID: 'walker', contentContainerStyle: { padding: 16, gap: 12 } },
    React.createElement(Text, { testID: 'walk-status' }, 'walk: ' + status + ' (' + measured + '/' + expected + ')'),
    React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } },
      entries.flatMap(function (entry) {
        return entry.sample.map(function (state) {
          const key = entry.name + '/' + state.label;
          return React.createElement(SafeCell, {
            key: key,
            Component: ctx.Registry[entry.name],
            entry: entry,
            state: state,
            onLayout: function (event) {
              const first = cells.current[key] === undefined;
              cells.current[key] = {
                component: entry.name,
                state: state.label,
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height
              };
              if (first) {
                setMeasured(function (n) {
                  return n + 1;
                });
              }
            },
            onError: function (message) {
              errors.current.push({ component: entry.name, state: state.label, message: message });
            }
          });
        });
      })));

}
