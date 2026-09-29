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

@param {Object} props          - React props
@param {String} props.server   - Walk server origin, e.g. http://localhost:8787
@param {Number} [props.pollMs] - Poll interval (default 1000)

@return {Object} - React element
*********************************************************************/
export default function Autopilot (props) {

  // Init the container and the current command
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text } = Lib.ReactNative;
  const { ThemeProvider } = Lib.ThemeContext;
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

  // Render the status line and, under a command, the walker for it
  return React.createElement(View, { testID: 'autopilot', style: { flex: 1 } },
    React.createElement(Text, { testID: 'autopilot-command' },
      'autopilot: ' + (command ? command.theme + ' / ' + (command.family || 'all') : 'waiting') + ' (' + polls + ')'),
    command ? React.createElement(ThemeProvider, { key: JSON.stringify(command), profile: command.theme, scheme: command.scheme, brand: command.brand },
      React.createElement(Walker, { family: command.family || undefined, report: props.server + '/report' })) : null);

}
