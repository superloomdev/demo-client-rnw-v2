// Info: Keeps live objects out of assertion failures.
//
// When an assertion fails, node:assert keeps both operands on the error
// and the test reporter formats them. A DOM node, a rendered instance, an
// event or a style object is a graph with no practical end: formatting it
// costs memory without bound (2026-11-17: one failing
// `assert.equal(container.querySelector(...), null)` took 367 GB). A rule
// that says "pass primitives" depends on every author remembering it, so
// the test host enforces it here, once, before any test file loads.
//
// Every equality assertion is wrapped. A live operand is replaced by a
// short token, one per object, so equal tokens mean the same object:
// identity is compared exactly as before and a failure prints a few words.
//
// Modes (ASSERT_LIVE):
//   label   (default) compare by token, never format the object
//   refuse  throw on any live operand, passing or not: the test must
//           assert a primitive (`node === null`, a property, a count)
// ASSERT_LIVE_CENSUS=<file> appends one line per call that passed a live
// operand (`file:line method`), in either mode.
//
// Usage: imported by harness/register.js before the tests.

import assert from 'node:assert';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const FLAT = ['equal', 'notEqual', 'strictEqual', 'notStrictEqual'];
const DEEP = ['deepEqual', 'notDeepEqual', 'deepStrictEqual', 'notDeepStrictEqual', 'partialDeepStrictEqual'];
const LABEL_ATTRIBUTES = ['id', 'role', 'data-part', 'data-testid', 'aria-label'];
const LABEL_MAX = 120;
const DEEP_LEVELS = 4;
const MODE = process.env.ASSERT_LIVE === 'refuse' ? 'refuse' : 'label';
const CENSUS = process.env.ASSERT_LIVE_CENSUS || '';

const tokens = new WeakMap();
let counter = 0;


/********************************************************************
Whether a value is a live object: one whose graph must never be
formatted. A DOM node, a collection of nodes, a window, an event, a
style declaration, a rendered test instance.

@param {*} value - Any value

@return {Boolean} - True for a live object
*********************************************************************/
export function isLive (value) {

  // Only objects and functions can be live
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  // A property read on a foreign object can throw: such an object is live
  try {
    // A DOM node or a document
    if (typeof value.nodeType === 'number' && typeof value.nodeName === 'string') {
      return true;
    }
    // A window
    if (value.window === value && typeof value.document === 'object') {
      return true;
    }
    // An event
    if (typeof value.preventDefault === 'function' && typeof value.type === 'string') {
      return true;
    }
    // A style declaration
    if (typeof value.getPropertyValue === 'function' && typeof value.cssText === 'string') {
      return true;
    }
    // A collection of nodes
    if (typeof value.item === 'function' && typeof value.length === 'number') {
      return true;
    }
    // A rendered test instance
    return typeof value.findByType === 'function' || (typeof value.toJSON === 'function' && typeof value.unmount === 'function');
  } catch {
    return true;
  }

}


/********************************************************************
A few words that name a live object: a node by its tag and identifying
attributes, anything else by its constructor.

@param {Object} value - A live object

@return {String} - The label, at most LABEL_MAX characters
*********************************************************************/
export function getLabel (value) {

  // A node: its tag and the attributes a reader finds it by
  let label = 'object';
  try {
    if (typeof value.nodeName === 'string') {
      label = '<' + value.nodeName.toLowerCase();
      for (const name of LABEL_ATTRIBUTES) {
        const text = typeof value.getAttribute === 'function' ? value.getAttribute(name) : null;
        if (typeof text === 'string' && text !== '') {
          label += ' ' + name + '="' + text + '"';
        }
      }
      label += '>';
    } else {
      label = value.constructor && typeof value.constructor.name === 'string' ? value.constructor.name : 'object';
    }
  } catch {
    // A label that cannot be read stays generic
  }

  // Bound the label
  return label.length > LABEL_MAX ? label.slice(0, LABEL_MAX) : label;

}


/********************************************************************
The token that stands for a live object: the same object always gets
the same token, two objects never share one.

@param {Object} value - A live object

@return {String} - '[live #n label]'
*********************************************************************/
function getToken (value) {

  // Number each object once
  if (!tokens.has(value)) {
    counter += 1;
    tokens.set(value, '[live #' + counter + ' ' + getLabel(value) + ']');
  }

  // Return its token
  return tokens.get(value);

}


/********************************************************************
Replace every live object in a value by its token. Arrays and plain
objects are copied only when they hold one; anything else is returned
as it is.

@param {*} value      - An assertion operand
@param {Number} levels - How deep arrays and plain objects are followed
@param {Object} found - { live: Boolean }, set when a live object is met

@return {*} - The value with live objects replaced
*********************************************************************/
function neutralize (value, levels, found) {

  // A live object becomes its token
  if (isLive(value)) {
    found.live = true;
    return getToken(value);
  }

  // Only arrays and plain objects are followed, and only so deep
  if (levels === 0 || value === null || typeof value !== 'object') {
    return value;
  }
  const plain = Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!plain) {
    return value;
  }

  // Copy the container only if something inside it changed
  let changed = false;
  const copy = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    copy[key] = neutralize(value[key], levels - 1, found);
    changed = changed || copy[key] !== value[key];
  }
  return changed ? copy : value;

}


/********************************************************************
The test file and line that called the assertion.

@return {String} - 'file:line', or 'unknown'
*********************************************************************/
function getCallSite () {

  // The first frame outside this file and outside node itself
  const frames = String(new Error().stack).split('\n').slice(1);
  for (const frame of frames) {
    if (frame.indexOf('assert-guard.js') === -1 && frame.indexOf('node:') === -1) {
      const match = /([^/\\(\s]+\.js):(\d+):\d+\)?$/.exec(frame.trim());
      if (match !== null) {
        return match[1] + ':' + match[2];
      }
    }
  }
  return 'unknown';

}


/********************************************************************
Wrap one assertion method of one assert object.

@param {Object} target - assert or assert.strict
@param {String} name   - The method name
@param {Number} levels - 0 for an identity method, DEEP_LEVELS for a deep one
*********************************************************************/
function wrap (target, name, levels) {

  // A method this node version does not have is left alone
  const original = target[name];
  if (typeof original !== 'function') {
    return;
  }

  target[name] = function guarded (actual, expected, message) {

    // Replace live operands by their tokens
    const found = { live: false };
    const safeActual = neutralize(actual, levels, found);
    const safeExpected = neutralize(expected, levels, found);

    // No live operand: the assertion runs untouched
    if (!found.live) {
      return original.call(target, actual, expected, message);
    }

    // Record the call, refuse it, or compare the tokens
    if (CENSUS !== '') {
      appendFileSync(CENSUS, getCallSite() + ' ' + name + '\n');
    }
    if (MODE === 'refuse') {
      throw new TypeError('assert.' + name + ' received a live object (' + getCallSite() + '): assert a primitive - `node === null`, a property or a count - so a failure prints a value, not a graph');
    }
    return original.call(target, safeActual, safeExpected, message);

  };

}


// Wrap both assert objects once, then let named imports see the wrappers
for (const target of [assert, assert.strict]) {
  for (const name of FLAT) {
    wrap(target, name, 0);
  }
  for (const name of DEEP) {
    wrap(target, name, DEEP_LEVELS);
  }
}
syncBuiltinESMExports();
