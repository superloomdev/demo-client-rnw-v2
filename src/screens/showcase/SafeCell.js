// Info: One showcase cell: a labelled frame around one sample state of one
// component, inside an error boundary so a throwing component shows its
// error in place and reports it, while every other cell still renders.
// Cells carry `dataSet` (component, state, family) so the web gates can
// find them; on native the same values are in the testID.
import { CELL_PADDING, CELL_BORDER } from './cell-chrome.js';


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
  The mounted sample: the component from `state.props` plus the state's
  `wrappers` composition applied around it through the registry, first
  entry outermost. Rendered as the Boundary's child so a bad wrapper is
  a recorded cell error, not a crashed page.

  @param {Object} props - { Component, entry, state, Registry }

  @return {Object} - React element
  *********************************************************************/
  function SampleBody (props) {

    let element = React.createElement(props.Component, props.state.props);
    const wrappers = Lib.Utils.isArray(props.state.wrappers) ? props.state.wrappers : [];
    for (let i = wrappers.length - 1; i >= 0; i = i - 1) {
      const descriptor = wrappers[i];
      const factory = descriptor && Lib.Utils.isString(descriptor.component)
        ? props.Registry[descriptor.component]
        : undefined;
      if (factory === undefined) {
        throw new TypeError('sample wrapper "' + (descriptor && descriptor.component) + '" of ' + props.entry.name + ' / ' + props.state.label + ' is not in the registry');
      }
      element = React.createElement(factory, descriptor.props || {}, element);
    }

    return element;

  }


  /********************************************************************
  One cell.

  @param {Object}   props           - React props
  @param {Object}   props.Component - The registry component
  @param {Object}   props.entry     - Catalog entry
  @param {Object}   props.state     - One sample state { label, props }
  @param {Object}   props.Registry  - The current theme's registry (the wrappers' factories)
  @param {Function} [props.Host]    - The registry's OverlayHost
  @param {String}   [props.captionColor] - The caption's color (the theme's secondary text)
  @param {String}   [props.borderColor]  - The frame's border color (the theme's subtle border)
  @param {Number}   [props.room]    - The width a cell body may take
  @param {Function} [props.onLayout] - Layout callback for the body
  @param {Function} [props.onError]  - Error callback

  @return {Object} - React element
  *********************************************************************/
  return function SafeCell (props) {

    // Init the identifiers the gates read
    const id = props.entry.name + '-' + props.state.label;

    // The guarded component. A `stage` frame's cell hosts it locally too:
    // an overlay (Menu, Modal) keeps its layer inside its own cell on every
    // platform, the way the web stage transform already does
    const guarded = React.createElement(Boundary, { onError: props.onError },
      React.createElement(SampleBody, {
        Component: props.Component,
        entry: props.entry,
        state: props.state,
        Registry: props.Registry
      }));
    const staged = props.entry.frame && props.entry.frame.stage === true && props.Host;
    const content = staged
      ? React.createElement(props.Host, null, guarded)
      : guarded;

    // Render the frame, the label and the guarded component
    return React.createElement(View, {
      testID: 'cell-' + id,
      dataSet: { cell: 'true', component: props.entry.name, state: props.state.label, family: props.entry.family },
      style: { padding: CELL_PADDING, borderWidth: CELL_BORDER, borderStyle: 'dashed', borderColor: props.borderColor === undefined ? '#c6c6c6' : props.borderColor, alignItems: 'flex-start', gap: 8 }
    },
    React.createElement(Text, { style: { fontSize: 11, color: props.captionColor === undefined ? '#6f6f6f' : props.captionColor } }, props.entry.name + ' / ' + props.state.label),
    // A component that fills its container is laid out in the frame its catalog entry names,
    // capped at the room the grid reports: a stage wider than the body would run off-screen.
    // A `stage` frame makes the body the containing block of a fixed layer, so an overlay
    // component paints its layer inside the cell it was mounted in. Every body caps at the
    // room too: a child's percentage max-width must resolve against the same definite room
    // on every platform (Yoga inherits the grid's constraint into an auto-size parent; CSS
    // ignores a percentage max-width whose containing block is indefinite)
    React.createElement(View, {
      testID: 'body-' + id,
      dataSet: { part: 'body' },
      onLayout: props.onLayout,
      style: Object.assign({
        maxWidth: props.room > 0 ? props.room : undefined
      }, props.entry.frame ? {
        height: props.entry.frame.height,
        transform: props.entry.frame.stage === true ? [{ translateX: 0 }] : undefined,
        width: props.room > 0 ? Math.min(props.entry.frame.width, props.room) : props.entry.frame.width
      } : {})
    }, content));

  };

}
