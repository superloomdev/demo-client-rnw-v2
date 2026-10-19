// Info: Autopilot: the walker driven by the walk server instead of by deep
// links. Polls `GET <server>/command` for `{ theme, family }`, and renders
// the walker under that theme (posting its report to `<server>/report`);
// a new command starts a new walk. iOS confirms a custom-scheme link opened
// from outside the app with a dialog no simulator command can tap, so the
// iOS gate launches the app plainly and steers it from here. Only a host
// that was built with the server address renders this.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Walker from './Walker.js';


/********************************************************************
Autopilot root.

@param {Object}   props        - React props
@param {String}   props.server - Walk server origin, e.g. http://localhost:8787
@param {Number}   [props.pollMs] - Poll interval (default 1000)
@param {Function} [props.Frame]  - The native frame (default: the injected
                                   plain View); renders inside the selected
                                   command's ThemeProvider

@return {Object} - React element
*********************************************************************/
export default function Autopilot (props) {

  // Init the container, the injected frame and the current command
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text } = Lib.ReactNative;
  const { ThemeProvider } = Lib.ThemeContext;
  const Frame = props.Frame === undefined ? View : props.Frame;
  const [command, setCommand] = React.useState(null);
  const [polls, setPolls] = React.useState(0);

  // Poll the server; adopt a command only when it differs from the current one
  React.useEffect(function () {
    let stopped = false;
    let current = null;
    const tick = function () {
      fetch(props.server + '/command').then(function (response) {
        return response.json();
      }).then(function (next) {
        if (stopped) {
          return;
        }
        setPolls(function (n) {
          return n + 1;
        });
        const key = next ? JSON.stringify(next) : null;
        if (key !== current) {
          current = key;
          setCommand(next);
        }
      }).catch(function () {
        // The server is not up yet; the next tick tries again
      });
    };
    tick();
    const timer = setInterval(tick, props.pollMs || 1000);
    return function () {
      stopped = true;
      clearInterval(timer);
    };
  }, [props.server, props.pollMs]);

  // Build the walker for the current command once per command: a poll only
  // advances the counter, and an unchanged element lets React skip the
  // cells, so polling never re-renders the walk (a full-catalog render can
  // outlast the poll interval)
  const walker = React.useMemo(function () {
    return command ? React.createElement(Walker, { family: command.family || undefined, report: props.server + '/report' }) : null;
  }, [command, props.server]);

  // Render the status line and, under a command, the provider owning the
  // frame, the scheme-colored status and the walker's scene
  return React.createElement(View, { testID: 'autopilot', style: { flex: 1 } },
    command === null
      ? React.createElement(Frame, null,
        React.createElement(Text, { testID: 'autopilot-command' },
          'autopilot: waiting (' + polls + ')'))
      : React.createElement(ThemeProvider, { key: JSON.stringify(command), profile: command.theme, scheme: command.scheme, brand: command.brand },
        React.createElement(Frame, null,
          React.createElement(Status, { command: command, polls: polls }),
          walker)));

}


/********************************************************************
The autopilot's status under a command: the same line it has always
drawn, now in the selected scheme's primary text color.

@param {Object} props         - React props
@param {Object} props.command - { theme, scheme, brand, family }
@param {Number} props.polls   - Polls so far

@return {Object} - React element
*********************************************************************/
function Status (props) {

  // Init the container and the selected theme's controller
  const Lib = useLib();
  const React = Lib.React;
  const { Text } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();

  // Render the command line in the scheme's primary text color
  return React.createElement(Text, {
    testID: 'autopilot-command',
    style: { color: ctx.theme['color.text_primary'] }
  }, 'autopilot: ' + props.command.theme + ' / ' + (props.command.family || 'all') + ' (' + props.polls + ')');

}
