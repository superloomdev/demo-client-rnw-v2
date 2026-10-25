// Info: One full-page screenshot per family per profile, plus the acme
// brand over carbon, at each of the three form classes' widths (375
// compact, 768 medium, 1280 expanded), written to
// test-results/showcase/<form>/ for the layer-4 review. Evidence only;
// baselines are frozen later, after the gates pass.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { FAMILIES, PROFILES, openPage, waitForFamily } from './helpers/showcase.js';

const OUT = join(process.cwd(), 'test-results', 'showcase');

const SELECTIONS = PROFILES.map(function (profile) {
  return { name: profile, query: 'profile=' + profile };
}).concat([{ name: 'carbon-acme', query: 'profile=carbon&brand=acme' }]);

const FORMS = [
  { name: 'compact', width: 375, height: 800 },
  { name: 'medium', width: 768, height: 800 },
  { name: 'expanded', width: 1280, height: 800 }
];


for (const form of FORMS) {
  for (const family of FAMILIES) {
    test(family + ': screenshots under every profile and the acme brand (' + form.name + ')', async function ({ page }) {
      mkdirSync(join(OUT, form.name), { recursive: true });
      await page.setViewportSize({ width: form.width, height: form.height });
      for (const selection of SELECTIONS) {
        const errors = await openPage(page, '/showcase/' + family + '?' + selection.query);
        await waitForFamily(page, family);
        await page.screenshot({ path: join(OUT, form.name, family + '-' + selection.name + '.png'), fullPage: true });
        expect(errors, selection.name).toEqual([]);
      }
    });
  }
}
