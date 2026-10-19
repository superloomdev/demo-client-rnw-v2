// Info: The brand probe distinguishes roles, not coincident default RGBs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { focusBrandIssues } from '../../e2e/helpers/focus-brand.js';

const BLUE = 'rgb(15, 98, 254)';
const BRAND = 'rgb(194, 65, 12)';
const INVERSE = 'rgb(57, 57, 57)';
const own = { normal: [BLUE], inverseFocus: BLUE, inverseSurface: INVERSE };
const branded = { normal: [BRAND], inverseFocus: BLUE, inverseSurface: INVERSE };
const entry = (color, inverse = false) => ({
  colors: [color], surfaces: [inverse ? INVERSE : 'rgb(244, 244, 244)'], changed: true, browserRing: false
});

test('a normal focus leak still fails even when inverse focus shares its old RGB', function () {
  assert.notDeepEqual(focusBrandIssues(entry(BLUE), entry(BLUE), own, branded), []);
  assert.deepEqual(focusBrandIssues(entry(BLUE), entry(BRAND), own, branded), []);
});

test('an independent inverse role retains its color unless the brand overrides that role', function () {
  assert.deepEqual(focusBrandIssues(entry(BLUE, true), entry(BLUE, true), own, branded), []);
  const inverseBrand = { ...branded, inverseFocus: BRAND };
  assert.notDeepEqual(focusBrandIssues(entry(BLUE, true), entry(BLUE, true), own, inverseBrand), []);
  assert.deepEqual(focusBrandIssues(entry(BLUE, true), entry(BRAND, true), own, inverseBrand), []);
});

test('an inverse surface may still use the branded normal focus role', function () {
  assert.deepEqual(focusBrandIssues(entry(BLUE, true), entry(BRAND, true), own, branded), []);
});

test('missing focus and browser rings are never waived by inverse context', function () {
  assert.ok(focusBrandIssues(entry(BLUE, true), { ...entry(BLUE, true), changed: false }, own, branded).includes('focus draws nothing'));
  assert.ok(focusBrandIssues(entry(BLUE, true), { ...entry(BLUE, true), browserRing: true }, own, branded).includes('focus draws the browser ring'));
});
