// Info: Accessibility identity on the host. For every family, the
// accessibility tree of every cell is identical under the three profiles:
// a template changes how a component looks, never what it is. The same
// identity holds across the template's own sample brands and the three
// form classes: neither a brand layer nor a viewport moves a role or a name.
import { expect, test } from '@playwright/test';

import { FAMILIES, PROFILES, openPage, getA11yTrees, waitForFamily } from './helpers/showcase.js';


// The explorer's own control strip is theme furniture, not component
// output; the identity reads the family grid only (see getA11yTrees)
const BRAND_QUERIES = ['&brand=rounded', '&brand=acme'];
const FORM_QUERIES = ['&form=compact', '&form=medium', '&form=expanded'];


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

for (const family of FAMILIES) {
  test(family + ': the accessibility tree is identical across brands', async function ({ page }) {
    const trees = {};
    for (const brand of BRAND_QUERIES) {
      await openPage(page, '/showcase/' + family + '?profile=carbon' + brand);
      await waitForFamily(page, family);
      trees[brand] = await getA11yTrees(page);
    }
    const keys = Object.keys(trees[BRAND_QUERIES[0]]);
    for (const key of keys) {
      expect(trees[BRAND_QUERIES[1]][key], key + ': rounded vs acme').toEqual(trees[BRAND_QUERIES[0]][key]);
    }
  });
}

for (const family of FAMILIES) {
  test(family + ': the accessibility tree is identical across the three form classes', async function ({ page }) {
    const trees = {};
    for (const form of FORM_QUERIES) {
      await openPage(page, '/showcase/' + family + '?profile=carbon' + form);
      await waitForFamily(page, family);
      trees[form] = await getA11yTrees(page);
    }
    const keys = Object.keys(trees[FORM_QUERIES[0]]);
    for (const form of FORM_QUERIES.slice(1)) {
      for (const key of keys) {
        expect(trees[form][key], key + ': ' + FORM_QUERIES[0] + ' vs ' + form).toEqual(trees[FORM_QUERIES[0]][key]);
      }
    }
  });
}
