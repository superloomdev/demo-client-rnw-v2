// Info: Accessibility identity on the host. For every family, the
// accessibility tree of every cell is identical under the three profiles:
// a template changes how a component looks, never what it is.
import { expect, test } from '@playwright/test';

import { FAMILIES, PROFILES, openPage, getA11yTrees, waitForFamily } from './helpers/showcase.js';


for (const family of FAMILIES) {
  test(family + ': the accessibility tree is identical under every profile', async function ({ page }) {
    const trees = {};
    for (const profile of PROFILES) {
      await openPage(page, '/showcase/' + family + '?profile=' + profile);
      await waitForFamily(page, family);
      trees[profile] = await getA11yTrees(page);
    }
    const keys = Object.keys(trees[PROFILES[0]]);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const profile of PROFILES.slice(1)) {
      expect(Object.keys(trees[profile]).sort()).toEqual(keys.slice().sort());
      for (const key of keys) {
        expect(trees[profile][key], key + ': ' + PROFILES[0] + ' vs ' + profile).toEqual(trees[PROFILES[0]][key]);
      }
    }
  });
}
