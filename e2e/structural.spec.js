// Info: Structural gate on the host. Every cell body has visible, non-empty
// content, and nothing a component draws spills outside its cell.
import { expect, test } from '@playwright/test';

import { FAMILIES, PROFILES, openPage, waitForFamily } from './helpers/showcase.js';


for (const profile of PROFILES) {
  for (const family of FAMILIES) {
    test(family + ' / ' + profile + ': content is non-empty and inside its cell', async function ({ page }) {
      await openPage(page, '/showcase/' + family + '?profile=' + profile);
      await waitForFamily(page, family);
      const cells = await page.evaluate(function () {
        return Array.from(document.querySelectorAll('[data-cell="true"]')).map(function (cell) {
          const box = cell.getBoundingClientRect();
          const body = cell.querySelector('[data-part="body"]');
          return {
            id: cell.getAttribute('data-component') + '/' + cell.getAttribute('data-state'),
            body: body.getBoundingClientRect().toJSON(),
            parts: Array.from(body.querySelectorAll('*')).map(function (node) {
              const r = node.getBoundingClientRect();
              return { tag: node.tagName.toLowerCase(), x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
            }),
            box: { x: box.x, y: box.y, right: box.right, bottom: box.bottom }
          };
        });
      });
      for (const cell of cells) {
        expect(cell.body.width, cell.id + ' body width').toBeGreaterThan(0);
        expect(cell.body.height, cell.id + ' body height').toBeGreaterThan(0);
        expect(cell.parts.length, cell.id + ' rendered nothing').toBeGreaterThanOrEqual(1);
        for (const part of cell.parts) {
          if (part.width === 0 && part.height === 0) {
            continue;
          }
          expect(part.x, cell.id + ' <' + part.tag + '> left').toBeGreaterThanOrEqual(cell.box.x - 0.5);
          expect(part.y, cell.id + ' <' + part.tag + '> top').toBeGreaterThanOrEqual(cell.box.y - 0.5);
          expect(part.right, cell.id + ' <' + part.tag + '> right').toBeLessThanOrEqual(cell.box.right + 0.5);
          expect(part.bottom, cell.id + ' <' + part.tag + '> bottom').toBeLessThanOrEqual(cell.box.bottom + 0.5);
        }
      }
    });
  }
}
