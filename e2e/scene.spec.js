// Info: The host scene is themed too; correct component tokens cannot
// compensate for a white native page behind a dark component system.
import { expect, test } from '@playwright/test';

import { WALK_CASES } from '../scripts/walk-matrix.js';
import { openPage, waitForFamily } from './helpers/showcase.js';

const rgb = hex => 'rgb(' + [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(', ') + ')';

for (const entry of WALK_CASES) {
  test(entry.theme + '/' + entry.scheme + ': the scene and status use the actual theme palette', async function ({ page }) {
    const errors = await openPage(page, '/walk/Form?theme=' + entry.theme + '&scheme=' + entry.scheme);
    await expect(page.getByTestId('walk-status')).toContainText('walk: done');
    const tokens = await page.evaluate(() => globalThis.__walk.tokens);
    await expect(page.getByTestId('scene')).toHaveCSS('background-color', rgb(tokens['color.background']));
    await expect(page.getByTestId('walk-status')).toHaveCSS('color', rgb(tokens['color.text_primary']));
    await expect(page.getByTestId('explorer')).toHaveCount(0);
    expect(errors).toEqual([]);

    const familyErrors = await openPage(page, '/showcase/Form?theme=' + entry.theme + '&scheme=' + entry.scheme);
    await waitForFamily(page, 'Form');
    await expect(page.getByTestId('explorer')).toBeVisible();
    await expect(page.getByTestId('family-title')).toHaveCSS('color', rgb(tokens['color.text_primary']));
    await expect(page.getByTestId('component-title-Form')).toHaveCSS('color', rgb(tokens['color.text_primary']));
    expect(familyErrors).toEqual([]);

    const indexErrors = await openPage(page, '/?theme=' + entry.theme + '&scheme=' + entry.scheme);
    await expect(page.getByTestId('showcase-selection')).toHaveCSS('color', rgb(tokens['color.text_primary']));
    await expect(page.getByTestId('showcase-progress')).toHaveCSS('color', rgb(tokens['color.text_primary']));
    expect(indexErrors).toEqual([]);
  });
}
