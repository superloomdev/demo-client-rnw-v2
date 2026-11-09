// Info: Scene: the themed page every routed screen paints. The containing
// View draws the selected scheme's background behind the route and confines
// the route's own overlay host: the layer root is an absolute sibling the
// host paints inside this box, so a retained screen's open layers detach
// with it instead of stacking over the next native screen. The app's
// global RootHost remains as the fallback for content outside a Scene.
import { useLib } from '../app-core/contexts/lib-context.js';
import ExplorerBar from './showcase/ExplorerBar.js';


/********************************************************************
Scene root: the positioned themed page with the route's own overlay host
inside it.

@param {Object} props          - React props
@param {String} [props.testID] - Page test identifier (default 'scene')
@param {Boolean} [props.explorer] - Draw the explorer strip (default true; walk scenes pass false)
@param {Node}   props.children - The screen's content

@return {Object} - React element
*********************************************************************/
export default function Scene (props) {

  // Init the container and the selected theme's controller
  const Lib = useLib();
  const React = Lib.React;
  const { View } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();

  // Render the themed page with the explorer's control strip at the top and
  // the route's local layer host confined inside. The root reports the
  // resolved build so a gate can wait for the state it measures
  return React.createElement(View, {
    testID: props.testID === undefined ? 'scene' : props.testID,
    dataSet: { form: ctx.resolvedForm, adaptive: ctx.adaptive, textScale: String(ctx.textScale), dir: ctx.dir },
    style: { flex: 1, position: 'relative', backgroundColor: ctx.theme['color.background'] }
  },
  props.explorer !== false ? React.createElement(ExplorerBar) : null,
  React.createElement(ctx.Registry.OverlayHost, { testID: 'scene-layers' }, props.children));

}
