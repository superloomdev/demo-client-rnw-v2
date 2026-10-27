// Info: Fixed native parity cases and collision-free evidence identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reportName, walkCases, WALK_CASES } from '../../scripts/walk-matrix.js';

test('native parity declares both real scheme IDs for every template', function () {
  assert.deepEqual(WALK_CASES, [
    { theme: 'default', mode: 'light', scheme: 'light' },
    { theme: 'default', mode: 'dark', scheme: 'dark' },
    { theme: 'carbon', mode: 'light', scheme: 'white' },
    { theme: 'carbon', mode: 'dark', scheme: 'g100' }
  ]);
  assert.equal(walkCases(['default', 'carbon'], ['light', 'dark']).length, 4);
  assert.deepEqual(walkCases(['carbon'], ['dark']), [{ theme: 'carbon', mode: 'dark', scheme: 'g100' }]);
  assert.throws(() => walkCases(['unknown'], ['light']), TypeError);
  assert.throws(() => walkCases(['carbon'], ['g100']), TypeError);
});

test('report identity never collides between schemes, brands or families', function () {
  const cases = WALK_CASES.map(entry => reportName({ platform: 'ios', ...entry }));
  assert.equal(new Set(cases).size, WALK_CASES.length);
  assert.equal(reportName({ platform: 'web', theme: 'carbon', scheme: 'g100', family: 'Select' }), 'web-carbon-g100-Select.json');
  assert.equal(reportName({ platform: 'web', theme: 'carbon', scheme: 'g100', brand: 'acme' }), 'web-carbon-g100-acme.json');
  assert.throws(() => reportName({ platform: 'ios', theme: 'carbon' }), TypeError);
  assert.throws(() => reportName({ platform: '../../outside', theme: 'carbon', scheme: 'white' }), TypeError);
});
