// Info: The walker end to end on web, the same code path the native gate
// drives by deep link: every catalog state renders and measures, the report
// is POSTed to the walk server, and the file it writes has zero errors, a
// non-zero size for every cell and the theme's font roles.
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { catalog, openPage } from './helpers/showcase.js';
import { reportName, WALK_CASES } from '../scripts/walk-matrix.js';

// The native gate's web baseline must see the same room a device's grid
// leaves a cell: WALK_VIEWPORT reruns this spec at that viewport width. The
// walker's scroll padding sits between the viewport and the grid width the
// report names, and walk-assert fails the run when the two differ, so the
// workflow names the viewport, not the grid width
const WALK_VIEWPORT = process.env.WALK_VIEWPORT
  ? { width: Number(process.env.WALK_VIEWPORT), height: 720 }
  : null;
if (WALK_VIEWPORT) {
  test.use({ viewport: WALK_VIEWPORT });
}

const WALK_OUT = join(process.cwd(), 'test-results', 'walk');
const EXPECTED_CELLS = catalog.reduce(function (sum, entry) {
  return sum + entry.sample.filter(function (state) {
    return state.cell !== false;
  }).length;
}, 0);


for (const entry of WALK_CASES) {
  const profile = entry.theme;
  const scheme = entry.scheme;
  test(profile + '/' + scheme + ': the walker measures every cell and delivers its report', async function ({ page }) {
    const errors = await openPage(page, '/walk?theme=' + profile + '&scheme=' + scheme + '&report=' + encodeURIComponent('http://localhost:8787/report'));
    await expect(page.getByTestId('walk-status')).toContainText('walk: sent', { timeout: 20000 });
    const file = join(WALK_OUT, reportName({ platform: 'web', theme: profile, scheme: scheme }));
    expect(existsSync(file), file).toBe(true);
    const report = JSON.parse(readFileSync(file, 'utf8'));
    expect(report.schema).toBe(1);
    expect(report.platform).toBe('web');
    expect(report.theme).toBe(profile);
    expect(report.scheme).toBe(scheme);
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
