// Info: Page readiness. The showcase index and every family page load under
// every profile with zero page errors, console errors, failed requests or
// error responses, and show the selection and the catalog's families.
import { expect, test } from '@playwright/test';

import { FAMILIES, PROFILES, openPage, waitForFamily } from './helpers/showcase.js';


for (const profile of PROFILES) {

  test('index / ' + profile + ': selection, every family, zero errors', async function ({ page }) {
    const errors = await openPage(page, '/?profile=' + profile);
    await expect(page.getByTestId('showcase-selection')).toContainText(profile + ' / ');
    for (const family of FAMILIES) {
      await expect(page.getByTestId('family-link-' + family)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  for (const family of FAMILIES) {
    test(family + ' / ' + profile + ': every cell renders, zero errors', async function ({ page }) {
      const errors = await openPage(page, '/showcase/' + family + '?profile=' + profile);
      const expected = await waitForFamily(page, family);
      expect(expected).toBeGreaterThanOrEqual(1);
      await expect(page.getByTestId('cell-error')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

}
