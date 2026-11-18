// Info: The brand probe distinguishes roles, not coincident default RGBs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { focusBrandIssues, focusRoleIssues } from '../../e2e/helpers/focus-brand.js';

const BLUE = 'rgb(15, 98, 254)';
const BRAND = 'rgb(194, 65, 12)';
const INVERSE = 'rgb(57, 57, 57)';
const PRIMARY = 'rgb(123, 31, 162)';
const own = { normal: [BLUE], inverseFocus: BLUE, inverseSurface: INVERSE };
const branded = { normal: [BRAND], inverseFocus: BLUE, inverseSurface: INVERSE };
// Under `roles` the primary button color, the template's focus blue, draws its own
const roles = { normal: [BRAND], inverseFocus: BLUE, inverseSurface: INVERSE, others: [PRIMARY] };
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

test('under roles a part drawing another role\'s color passes, though the brand left its template color', function () {
  // A calendar day: upstream draws its focus in the primary button color
  assert.deepEqual(focusBrandIssues(entry(BLUE), entry(PRIMARY), own, roles), []);
  assert.deepEqual(focusRoleIssues(entry(BLUE), entry(PRIMARY), branded, roles), []);
});

test('under roles a part still drawing the template focus color is a leak', function () {
  const issues = focusBrandIssues(entry(BLUE), entry(BLUE), own, roles);
  assert.equal(issues.includes('focus still draws the template color ' + JSON.stringify([BLUE])), true);
});

test('a part drawing the focus role under roles draws the brand color under the brand', function () {
  const issues = focusRoleIssues(entry(BLUE), entry(BRAND), branded, roles);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].startsWith('focus draws the focus role under roles'), true);
  assert.deepEqual(focusRoleIssues(entry(BRAND), entry(BRAND), branded, roles), []);
});

test('under roles an inverse focus value shared with a surface is not a leak', function () {
  // Carbon white: inverse focus and the inset ring are both white
  const WHITE = 'rgb(255, 255, 255)';
  const whiteOwn = { normal: [BLUE], inverseFocus: WHITE, inverseSurface: INVERSE };
  const whiteRoles = { ...roles, inverseFocus: 'rgb(158, 157, 36)' };
  const ring = { ...entry(BRAND, true), colors: [BRAND, WHITE] };
  assert.deepEqual(focusBrandIssues({ ...entry(BLUE, true), colors: [BLUE, WHITE] }, ring, whiteOwn, whiteRoles), []);
});
