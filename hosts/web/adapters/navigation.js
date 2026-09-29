// Info: Web adapter for the Navigation slot.
// Maps the navigation contract onto simple web navigation primitives.
// This is a portability harness, not a production router.
import React from 'react';

function Link (props) {
  const { href, asChild, children, ...rest } = props;

  function navigate (e) {
    e.preventDefault();
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ...rest, onPress: navigate });
  }
  return React.createElement('a', { href: href, onClick: navigate, ...rest }, children);
}

function Redirect (props) {
  React.useEffect(function () {
    window.location.replace(props.href);
  }, [props.href]);
  return null;
}


export default function (Lib, config) { // eslint-disable-line no-unused-vars

  // Ready-to-use navigation surface; the loader assigns it to Lib.Navigation
  return {
    Link: Link,
    Redirect: Redirect
  };

};
