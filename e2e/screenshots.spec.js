// Info: One full-page screenshot per family per profile, plus the acme
// brand over carbon, written to test-results/showcase/ for the layer-4
// review. Evidence only; baselines are frozen later, after the gates pass.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { FAMILIES, PROFILES, openPage, waitForFamily } from './helpers/showcase.js';

const OUT = join(process.cwd(), 'test-results', 'showcase');

const SELECTIONS = PROFILES.map(function (profile) {
  return { name: profile, query: 'profile=' + profile };
}).concat([{ name: 'carbon-acme', query: 'profile=carbon&brand=acme' }]);


for (const family of FAMILIES) {
  test(family + ': screenshots under every profile and the acme brand', async function ({ page }) {
    mkdirSync(OUT, { recursive: true });
    for (const selection of SELECTIONS) {
      const errors = await openPage(page, '/showcase/' + family + '?' + selection.query);
      await waitForFamily(page, family);
      await page.screenshot({ path: join(OUT, family + '-' + selection.name + '.png'), fullPage: true });
      expect(errors, selection.name).toEqual([]);
    }
  });
}
