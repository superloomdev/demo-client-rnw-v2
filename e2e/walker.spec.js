// Info: The walker end to end on web, the same code path the native gate
// drives by deep link: every catalog state renders and measures, the report
// is POSTed to the walk server, and the file it writes has zero errors, a
// non-zero size for every cell and the theme's font roles.
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROFILES, catalog, openPage } from './helpers/showcase.js';

const WALK_OUT = join(process.cwd(), 'test-results', 'walk');
const EXPECTED_CELLS = catalog.reduce(function (sum, entry) {
  return sum + entry.sample.length;
}, 0);


for (const profile of PROFILES) {
  test(profile + ': the walker measures every cell and delivers its report', async function ({ page }) {
    const errors = await openPage(page, '/walk?theme=' + profile + '&report=' + encodeURIComponent('http://localhost:8787/report'));
    await expect(page.getByTestId('walk-status')).toContainText('walk: sent', { timeout: 20000 });
    const file = join(WALK_OUT, 'web-' + profile + '.json');
    expect(existsSync(file), file).toBe(true);
    const report = JSON.parse(readFileSync(file, 'utf8'));
    expect(report.schema).toBe(1);
    expect(report.platform).toBe('web');
    expect(report.theme).toBe(profile);
    expect(report.errors).toEqual([]);
    expect(report.expectedCells).toBe(EXPECTED_CELLS);
    expect(report.cells.length).toBe(EXPECTED_CELLS);
    for (const cell of report.cells) {
      expect(cell.width, cell.component + '/' + cell.state).toBeGreaterThan(0);
      expect(cell.height, cell.component + '/' + cell.state).toBeGreaterThan(0);
    }
    expect(report.fonts.length).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
