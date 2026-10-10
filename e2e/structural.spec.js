// Info: Structural gate on the host. Every cell body has visible, non-empty
// content, and nothing a component paints spills outside its cell. A fixed
// layer is checked against the bounds its containing block gives it: a
// staged cell's own body, or the viewport for a layer that is meant to
// cover it.
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
          // An element draws nothing when it or an ancestor in the cell is
          // transparent, hidden or undisplayed, or it is a leaf that paints
          // no pixels of its own - no fill, image, border, shadow or ring,
          // and no text (a transparent hit layer)
          const isUndrawn = function (node) {
            for (let current = node; current !== null && current !== body; current = current.parentElement) {
              const style = window.getComputedStyle(current);
              if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') {
                return true;
              }
              if (current.getAttribute('aria-hidden') === 'true' && current.getBoundingClientRect().height === 0) {
                return true;
              }
            }
            if (!(node instanceof window.SVGElement) && node.children.length === 0 && (node.textContent || '').trim() === '') {
              const style = window.getComputedStyle(node);
              if (style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none' &&
                  style.borderTopWidth === '0px' && style.boxShadow === 'none' && style.outlineStyle === 'none') {
                return true;
              }
            }
            return false;
          };
          // The painted part of a node: its box cut down by every ancestor
          // inside the cell whose overflow hides the run-out (a swept bar)
          const paintedRect = function (node) {
            let r = node.getBoundingClientRect();
            for (let current = node.parentElement; current !== null && current !== cell.parentElement; current = current.parentElement) {
              const overflow = window.getComputedStyle(current).overflow;
              if (overflow !== 'visible') {
                const bounds = current.getBoundingClientRect();
                const x = Math.max(r.x, bounds.x);
                const y = Math.max(r.y, bounds.y);
                const right = Math.min(r.x + r.width, bounds.x + bounds.width);
                const bottom = Math.min(r.y + r.height, bounds.y + bounds.height);
                r = { x: x, y: y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
              }
            }
            return r;
          };
          // The fixed layer an element belongs to, if any: the nearest
          // ancestor-or-self positioned fixed. A layer whose containing
          // block is a transformed ancestor inside the cell is bounded by
          // the cell, not the viewport
          const overlayOf = function (node) {
            for (let current = node; current !== null && current !== body.parentElement; current = current.parentElement) {
              if (window.getComputedStyle(current).position === 'fixed') {
                return current;
              }
            }
            return null;
          };
          const hasStage = function (overlay) {
            for (let current = overlay.parentElement; current !== null && current !== body.parentElement; current = current.parentElement) {
              if (window.getComputedStyle(current).transform !== 'none') {
                return true;
              }
            }
            return false;
          };
          return {
            id: cell.getAttribute('data-component') + '/' + cell.getAttribute('data-state'),
            body: body.getBoundingClientRect().toJSON(),
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
            parts: Array.from(body.querySelectorAll('*')).map(function (node) {
              const r = node.getBoundingClientRect();
              const overlay = overlayOf(node);
              const overlayRect = overlay === null ? null : overlay.getBoundingClientRect();
              return {
                tag: node.tagName.toLowerCase(),
                undrawn: isUndrawn(node),
                overlay: overlay !== null,
                contained: overlay !== null && hasStage(overlay),
                layerCovers: overlay !== null && overlayRect.width >= window.innerWidth && overlayRect.height >= window.innerHeight,
                x: r.x, y: r.y, right: r.right, bottom: r.bottom,
                width: r.width, height: r.height,
                painted: paintedRect(node)
              };
            })
          };
        });
      });
      for (const cell of cells) {
        expect(cell.body.width, cell.id + ' body width').toBeGreaterThan(0);
        expect(cell.body.height, cell.id + ' body height').toBeGreaterThan(0);
        expect(cell.parts.length, cell.id + ' rendered nothing').toBeGreaterThanOrEqual(1);
        for (const part of cell.parts) {
          // Nothing painted cannot overflow: an empty box, a transparent
          // state layer, a hidden sizer
          if ((part.width === 0 && part.height === 0) || part.undrawn) {
            continue;
          }
          // A fixed layer's containing block is the viewport, unless a
          // transformed ancestor inside the cell re-bounds it to the cell;
          // a layer that covers the viewport by design (a scrim) is
          // viewport-bounded either way. A viewport layer of a cell off
          // the screen has no meaningful bound at all
          const covers = part.layerCovers === true;
          const free = part.overlay && (!part.contained || covers);
          const offscreen = cell.box.x + cell.box.width <= cell.viewport.x ||
                            cell.box.y + cell.box.height <= cell.viewport.y ||
                            cell.box.x >= cell.viewport.x + cell.viewport.width ||
                            cell.box.y >= cell.viewport.y + cell.viewport.height;
          if (free && offscreen && !covers) {
            continue;
          }
          // The part of a viewport layer that lies on the screen is what it
          // paints; its overflow past the screen edge clips away. Every
          // other part paints what survives its ancestors' clipping
          const painted = free ? {
            x: Math.max(part.x, cell.viewport.x),
            y: Math.max(part.y, cell.viewport.y),
            width: Math.max(0, Math.min(part.right, cell.viewport.x + cell.viewport.width) - Math.max(part.x, cell.viewport.x)),
            height: Math.max(0, Math.min(part.bottom, cell.viewport.y + cell.viewport.height) - Math.max(part.y, cell.viewport.y))
          } : part.painted;
          if (painted.width === 0 && painted.height === 0) {
            continue;
          }
          const bounds = free ? cell.viewport : cell.box;
          expect(painted.x, cell.id + ' <' + part.tag + '> left').toBeGreaterThanOrEqual(bounds.x - 0.5);
          expect(painted.y, cell.id + ' <' + part.tag + '> top').toBeGreaterThanOrEqual(bounds.y - 0.5);
          expect(painted.x + painted.width, cell.id + ' <' + part.tag + '> right').toBeLessThanOrEqual(bounds.x + bounds.width + 0.5);
          expect(painted.y + painted.height, cell.id + ' <' + part.tag + '> bottom').toBeLessThanOrEqual(bounds.y + bounds.height + 0.5);
        }
      }
    });
  }
}
