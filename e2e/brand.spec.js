// Info: Brand-layer reach. The `acme` layer is sparse; every token it sets
// must reach what the host renders under every profile: its three glyphs in
// the drawn icons, its color, family and radii in the built theme the
// walker reports, and, in every rendered component, its family on every
// drawn text, its focus and interactive colours on whatever focus draws on
// every focusable part and its radius on a corner that names it. A brand that needs a component change to show is a
// component defect, not a bigger layer.
import { expect, test } from '@playwright/test';

import { BRAND_LAYERS } from '../src/themes/brand-layers.js';
import { FAMILIES, PROFILES, catalog, openPage, waitForFamily } from './helpers/showcase.js';

const ACME = BRAND_LAYERS.acme.tokens;

// The sans family each profile names on its own; the brand replaces it
const PROFILE_SANS = { default: 'IBM Plex Sans', carbon: 'IBM Plex Sans', material: 'Roboto' };


/********************************************************************
A hex color as the `rgb()` string computed styles report.

@param {String} hex - `#rrggbb`

@return {String} - `rgb(r, g, b)`
*********************************************************************/
function toRgb (hex) {

  return 'rgb(' + parseInt(hex.slice(1, 3), 16) + ', ' + parseInt(hex.slice(3, 5), 16) + ', ' + parseInt(hex.slice(5, 7), 16) + ')';

}


for (const profile of PROFILES) {

  test(profile + ' + acme: the three overridden glyphs are drawn', async function ({ page }) {
    const errors = await openPage(page, '/showcase/Icon?profile=' + profile + '&brand=acme');
    await waitForFamily(page, 'Icon');
    const drawn = await page.evaluate(function () {
      const out = {};
      for (const cell of document.querySelectorAll('[data-component="Icon"]')) {
        const path = cell.querySelector('svg path');
        out[cell.getAttribute('data-state')] = path ? path.getAttribute('d') : null;
      }
      return out;
    });
    // The sample states draw close (default), checkmark (decorative), search (large)
    expect(drawn.default).toBe(ACME['icon.close'].paths[0].d);
    expect(drawn.decorative).toBe(ACME['icon.checkmark'].paths[0].d);
    expect(drawn.large).toBe(ACME['icon.search'].paths[0].d);
    expect(errors).toEqual([]);
  });

  test(profile + ' + acme: color, family and radii reach the built theme', async function ({ page }) {
    const errors = await openPage(page, '/walk/Icon?profile=' + profile + '&brand=acme');
    await expect(page.getByTestId('walk-status')).toContainText('walk: done');
    const report = await page.evaluate(function () {
      return globalThis.__walk;
    });
    expect(report.brand).toBe('acme');
    for (const name of ['color.interactive', 'color.focus', 'shape.radius_04', 'shape.radius_08']) {
      expect(report.tokens[name], name).toBe(ACME[name]);
    }
    const sans = report.fonts.find(function (font) {
      return font.role === 'font.family.sans';
    });
    expect(sans).toEqual({ role: 'font.family.sans', family: 'Roboto', drawn: 'Roboto', loaded: true });
    expect(errors).toEqual([]);
  });

}


for (const profile of PROFILES) {

  test(profile + ' + acme: the family, focus color and radius reach every rendered component', async function ({ page }) {
    const reached = { texts: 0, focusables: 0, corners: 0 };
    const wrong = [];
    for (const family of FAMILIES) {
      const errors = await openPage(page, '/showcase/' + family + '?profile=' + profile + '&brand=acme');
      await waitForFamily(page, family);

      // No drawn text is left in the profile's own sans family, and the brand's family is drawn
      const texts = await page.evaluate(function () {
        return Array.from(document.querySelectorAll('[data-cell="true"] [data-part="body"] [dir="auto"]')).filter(function (node) {
          return node.textContent.trim() !== '' && window.getComputedStyle(node).opacity !== '0';
        }).map(function (node) {
          return window.getComputedStyle(node).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        });
      });
      reached.texts += texts.filter(function (familyName) {
        return familyName === ACME['font.family.sans'];
      }).length;
      wrong.push.apply(wrong, texts.filter(function (familyName) {
        return familyName === PROFILE_SANS[profile] && familyName !== ACME['font.family.sans'];
      }).map(function (familyName) {
        return family + ': text still drawn in ' + familyName;
      }));

      // Every enabled focusable part shows its focus in the brand's colours once focused. Each
      // template draws focus its own way (an outline ring, a border with an inset ring, a field
      // outline in the interactive colour), so what is checked is every outline, border and shadow
      // colour focus adds in the cell: at least one, each the brand's focus or interactive colour,
      // or the page colour a ring draws as its inner line; never the browser's own ring
      const focusables = page.locator('[data-cell="true"] :is([role="button"], [role="checkbox"], [role="combobox"], input):not([aria-disabled="true"]):not([disabled])');
      const count = await focusables.count();
      const allowed = [toRgb(ACME['color.focus']), toRgb(ACME['color.interactive'])];
      for (let i = 0; i < count; i++) {
        const target = focusables.nth(i);
        const paint = function (node) {
          const cell = node.closest('[data-cell="true"]');
          return Array.from(cell.querySelectorAll('*')).map(function (candidate) {
            const style = window.getComputedStyle(candidate);
            return {
              outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 ? style.outlineColor : null,
              border: style.borderTopColor,
              shadow: style.boxShadow
            };
          });
        };
        const before = await target.evaluate(paint);
        await target.focus();
        const after = await target.evaluate(paint);
        const pageColor = await target.evaluate(function (node) {
          let current = node;
          while (current) {
            const background = window.getComputedStyle(current).backgroundColor;
            if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
              return background;
            }
            current = current.parentElement;
          }
          return 'rgb(255, 255, 255)';
        });
        const added = [];
        after.forEach(function (style, index) {
          const was = before[index] || {};
          if (style.outline !== null && style.outline !== was.outline) {
            added.push(style.outline);
          }
          if (style.border !== was.border && style.border !== 'rgba(0, 0, 0, 0)') {
            added.push(style.border);
          }
          if (style.shadow !== was.shadow && style.shadow !== 'none') {
            added.push.apply(added, (style.shadow.match(/rgba?\([^)]*\)/g) || []).filter(function (color) {
              return !/, 0\)$/.test(color);
            }));
          }
        });
        reached.focusables += 1;
        if (added.length === 0 || added.some(function (color) {
          return !allowed.includes(color) && color !== pageColor;
        })) {
          wrong.push(family + ': focus drew ' + JSON.stringify(added));
        }
        await target.evaluate(function (node) {
          node.blur();
        });
      }

      // A corner that names an overridden radius takes the brand's value
      const corners = await page.evaluate(function (radius) {
        return Array.from(document.querySelectorAll('[data-cell="true"][data-state="rounded"] [data-part="body"] > div')).map(function (node) {
          return window.getComputedStyle(node).borderTopLeftRadius;
        }).filter(function (value) {
          return value !== '0px';
        }).map(function (value) {
          return value === radius + 'px';
        });
      }, ACME['shape.radius_08']);
      reached.corners += corners.length;
      if (corners.some(function (ok) {
        return !ok;
      })) {
        wrong.push(family + ': rounded corner not at the brand radius');
      }
      expect(errors).toEqual([]);
    }
    expect(wrong).toEqual([]);

    // Once the catalog carries text and focusable components, each reach must have been exercised
    const hasMore = catalog.some(function (entry) {
      return entry.family !== 'Icon';
    });
    if (hasMore) {
      expect(reached.texts).toBeGreaterThan(0);
      expect(reached.focusables).toBeGreaterThan(0);
    }
    test.info().annotations.push({ type: 'brand', description: profile + ' + acme: ' + reached.texts + ' texts, ' + reached.focusables + ' focusables, ' + reached.corners + ' corners' });
  });

}
