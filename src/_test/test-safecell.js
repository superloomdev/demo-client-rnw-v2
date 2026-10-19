// Info: SafeCell's sample-wrapper operation. A state's `wrappers` compose
// around the component through the registry passed to the cell, first
// entry outermost - catalog composition metadata, never a prop - and the
// operation stays inside the cell's error boundary.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import utils from '@superloomdev/js-helper-utils';

import createSafeCell from '../screens/showcase/SafeCell.js';

const Lib = {
  React: React,
  ReactNative: { View: 'View', Text: 'Text' },
  Utils: utils({})
};

// Stub registry providers with the section-depth semantics the real ones
// carry: a Section publishes one deeper, clamped at six, and the heading
// draws its level
const LevelContext = React.createContext(1);

function StubSection (props) {

  const level = React.useContext(LevelContext);
  return React.createElement(LevelContext.Provider, { value: Math.min(level + 1, 6) }, props.children);

}

function StubHeading (props) {

  const level = React.useContext(LevelContext);
  return React.createElement('Text', { testID: 'heading' }, 'h' + level + ' ' + props.children);

}

const Registry = { Section: StubSection, Heading: StubHeading };
const SafeCell = createSafeCell(Lib);
const entry = { name: 'Heading', family: 'Heading', frame: null };


/********************************************************************
Render one cell and return its heading text.

@param {Object} state - Sample state { label, props, wrappers? }

@return {String} - The rendered heading text
*********************************************************************/
function headingText (state) {

  let renderer;
  act(function () {
    renderer = TestRenderer.create(React.createElement(SafeCell, {
      Component: Registry.Heading,
      entry: entry,
      state: state,
      Registry: Registry,
      room: 400
    }));
  });
  return renderer.root.findByProps({ testID: 'heading' }).children.join('');

}

function sectionWrappers (count) {

  const wrappers = [];
  for (let i = 0; i < count; i = i + 1) {
    wrappers.push({ component: 'Section', props: {} });
  }
  return wrappers;

}


describe('SafeCell: sample wrappers compose through the registry', function () {

  test('one Section wrapper mounts the heading at level 2', function () {
    const state = { label: 'level 2', props: { children: 'x' }, wrappers: sectionWrappers(1) };
    assert.equal(headingText(state), 'h2 x');
  });

  test('seven Section wrappers clamp at level 6', function () {
    const state = { label: 'level 7', props: { children: 'x' }, wrappers: sectionWrappers(7) };
    assert.equal(headingText(state), 'h6 x');
  });

  test('an unwrapped sample stays at level 1', function () {
    const state = { label: 'level 1', props: { children: 'x' } };
    assert.equal(headingText(state), 'h1 x');
  });

  test('an unknown wrapper is a recorded cell error, not a crash', function () {
    const errors = [];
    const state = { label: 'bad', props: { children: 'x' }, wrappers: [{ component: 'Missing', props: {} }] };
    let renderer;
    act(function () {
      renderer = TestRenderer.create(React.createElement(SafeCell, {
        Component: Registry.Heading,
        entry: entry,
        state: state,
        Registry: Registry,
        room: 400,
        onError: function (message) {
          errors.push(message);
        }
      }));
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /sample wrapper "Missing" of Heading \/ bad is not in the registry/);
    assert.notEqual(renderer.root.findAllByProps({ testID: 'cell-error' }).length, 0);
  });

});
