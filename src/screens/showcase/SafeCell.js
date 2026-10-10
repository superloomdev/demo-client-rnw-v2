// Info: One showcase cell: a labelled frame around one sample state of one
// component, inside an error boundary so a throwing component shows its
// error in place and reports it, while every other cell still renders.
// Cells carry `dataSet` (component, state, family) so the web gates can
// find them; on native the same values are in the testID.


/********************************************************************
Build the SafeCell component for one React instance.

@param {Object} Lib - The container (React, ReactNative)

@return {Function} - SafeCell component
*********************************************************************/
export default function createSafeCell (Lib) {

  const React = Lib.React;
  const { View, Text } = Lib.ReactNative;


  // Error boundary: records the error once and renders it in place of the child
  class Boundary extends React.Component {

    constructor (props) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError (error) {
      // Return the error so the next render shows it
      return { error: error };
    }

    componentDidCatch (error) {
      // Report the error to the owner, once
      if (Lib.Utils.isFunction(this.props.onError)) {
        this.props.onError(String(error && error.message ? error.message : error));
      }
    }

    render () {
      // Render the error text, or the child when there is none
      if (this.state.error) {
        return React.createElement(Text, { testID: 'cell-error' }, 'Error: ' + String(this.state.error.message || this.state.error));
      }
      return this.props.children;
    }

  }


  /********************************************************************
  One cell.

  @param {Object}   props           - React props
  @param {Object}   props.Component - The registry component
  @param {Object}   props.entry     - Catalog entry
  @param {Object}   props.state     - One sample state { label, props }
  @param {Function} [props.onLayout] - Layout callback for the body
  @param {Function} [props.onError]  - Error callback

  @return {Object} - React element
  *********************************************************************/
  return function SafeCell (props) {

    // Init the identifiers the gates read
    const id = props.entry.name + '-' + props.state.label;

    // Render the frame, the label and the guarded component
    return React.createElement(View, {
      testID: 'cell-' + id,
      dataSet: { cell: 'true', component: props.entry.name, state: props.state.label, family: props.entry.family },
      style: { padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c6c6c6', alignItems: 'flex-start', gap: 8 }
    },
    React.createElement(Text, { style: { fontSize: 11, color: '#6f6f6f' } }, props.entry.name + ' / ' + props.state.label),
    // A component that fills its container is laid out in the frame its catalog entry names;
    // a `stage` frame makes the body the containing block of a fixed layer, so an overlay
    // component paints its layer inside the cell it was mounted in
    React.createElement(View, {
      testID: 'body-' + id,
      dataSet: { part: 'body' },
      onLayout: props.onLayout,
      style: props.entry.frame ? {
        height: props.entry.frame.height,
        transform: props.entry.frame.stage === true ? [{ translateX: 0 }] : undefined,
        width: props.entry.frame.width
      } : undefined
    },
    React.createElement(Boundary, { onError: props.onError },
      React.createElement(props.Component, props.state.props))));

  };

}
