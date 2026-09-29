// Info: Stand-in for react-native-svg in the Node test host. Renders plain
// `svg` and `path` host elements carrying the props the component library
// passes, so a rendered icon can be inspected for its viewBox, fill and path
// data with react-test-renderer.

import React from 'react';


function element (tag) {
  const Element = function (props) {
    return React.createElement(tag, props, props.children);
  };
  Element.displayName = tag;
  return Element;
}

export const Svg = element('svg');
export const G = element('g');
export const Path = element('path');
export default Svg;
