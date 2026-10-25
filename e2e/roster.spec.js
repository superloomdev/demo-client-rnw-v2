// Info: The whole-roster showcase end to end: the index reports the exact
// build progress and every family page draws a to-do card for each
// pending roster row and a cell grid for each built one. The expected
// counts are computed from the roster data itself, not the page code.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { catalog, openPage, waitForFamily } from './helpers/showcase.js';
import { PLANNED_ROWS } from '../src/screens/showcase/planned-rows.js';

const roster = JSON.parse(readFileSync(join(process.cwd(), 'hosts/web/node_modules/@superloomdev/rnw-components/data/roster.json'), 'utf8'));


// Family groups in roster order, the planned rows appended last
const GROUPS = [];
const allRows = roster.rows.concat(PLANNED_ROWS);
for (const row of allRows) {
  let group = GROUPS.find(function (candidate) {
    return candidate.family === row.family;
  });
  if (!group) {
    group = { family: row.family, rows: [] };
    GROUPS.push(group);
  }
  group.rows.push(row);
}
const BUILT = catalog.length;
const TOTAL = allRows.length;


test('the index reports the exact build progress', async function ({ page }) {
  const errors = await openPage(page, '/');
  await expect(page.getByTestId('showcase-progress')).toContainText(BUILT + ' of ' + TOTAL);
  expect(BUILT).toBe(73);
  expect(TOTAL).toBe(215);
  expect(errors).toEqual([]);
});

for (const group of GROUPS) {
  test(group.family + ': to-do cards for pending rows, cell grids for built rows', async function ({ page }) {
    const pending = group.rows.filter(function (row) {
      return row.status === 'pending' && !catalog.some(function (entry) {
        return entry.name === row.name;
      });
    });
    const built = group.rows.filter(function (row) {
      return catalog.some(function (entry) {
        return entry.name === row.name;
      });
    });
    const errors = await openPage(page, '/showcase/' + group.family + '?profile=carbon');
    await waitForFamily(page, group.family, { textScale: '1' }).catch(function () {
      // A family with no built rows has no cell-grid to wait for
    });
    expect(await page.getByTestId('family-title').count()).toBeGreaterThan(0);
    for (const row of pending) {
      expect(await page.getByTestId('todo-' + row.name).count(), 'todo-' + row.name).toBe(1);
    }
    expect(await page.locator('[data-testid="cell-grid"]').count()).toBe(built.length);
    expect(errors).toEqual([]);
  });
}
