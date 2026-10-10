// Info: Brand-layer reach. The `acme` layer is sparse; every token it sets
// must reach what the host renders under every profile: its three glyphs in
// the drawn icons, its color, family and radii in the built theme the
// walker reports, and, in every rendered component, its family on every
// drawn text, its focus and interactive colors on whatever focus draws on
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


// The enabled focusable parts of a showcase page, excluding parts a
// template mounts but does not draw (a close seat a template hides)
const FOCUSABLE = '[data-cell="true"] :is([role="button"], [role="checkbox"], [role="combobox"], input):not([aria-disabled="true"]):not([disabled]):visible';
// A computed color with zero alpha
const TRANSPARENT = /^rgba\(.*, 0\)$/;


/********************************************************************
The focus and interactive colors a profile draws without a brand, as the
walker reports its built theme.

@param {Object} page    - Playwright page
@param {String} profile - Profile name

@return {Promise<Array>} - [focus, interactive] as `rgb()` strings
*********************************************************************/
async function getOwnFocusColors (page, profile) {

  const errors = await openPage(page, '/walk/Icon?profile=' + profile);
  await expect(page.getByTestId('walk-status')).toContainText('walk: done');
  const tokens = await page.evaluate(function () {
    return globalThis.__walk.tokens;
  });
  expect(errors).toEqual([]);

  return [toRgb(tokens['color.focus']), toRgb(tokens['color.interactive'])];

}


/********************************************************************
The colors of the ring layers in a computed box-shadow: zero offset, zero
blur and a spread (an elevation shadow is not a ring).

@param {String} shadow - Computed `box-shadow`

@return {Array} - Colors, transparent layers left out
*********************************************************************/
function getRingColors (shadow) {

  if (shadow === 'none') {
    return [];
  }

  return shadow.split(/,(?![^(]*\))/).filter(function (layer) {
    const lengths = (layer.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    return lengths.length >= 4 && lengths[0] === 0 && lengths[1] === 0 && lengths[2] === 0 && lengths[3] > 0;
  }).map(function (layer) {
    return (layer.match(/rgba?\([^)]*\)/) || [''])[0];
  }).filter(function (color) {
    return color !== '' && !TRANSPARENT.test(color);
  });

}


/********************************************************************
The paint of every element in a focusable part's cell, read in the page.

@param {Object} node - The focusable element

@return {Object} - { state, parts: [{ outlineStyle, outlineWidth, outlineColor, borderColor, borderWidth, shadow, fill }] }
*********************************************************************/
function getPaint (node) {

  const cell = node.closest('[data-cell="true"]');

  return {
    state: cell.getAttribute('data-state'),
    parts: Array.from(cell.querySelectorAll('*')).map(function (candidate) {
      const style = window.getComputedStyle(candidate);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        shadow: style.boxShadow,
        fill: style.backgroundColor
      };
    })
  };

}


/********************************************************************
What focus draws on every enabled focusable part of a showcase page: the
colors it adds (a drawn outline, a border, a ring layer, a fill), whether
anything changed (a border width alone counts), and whether the browser
drew its own ring.

@param {Object} page   - Playwright page
@param {String} path   - Showcase path
@param {String} family - Component family

@return {Promise<Array>} - [{ state, colors, changed, browserRing }] in page order
*********************************************************************/
async function getFocusDrawn (page, path, family) {

  const errors = await openPage(page, path);
  await waitForFamily(page, family);
  const focusables = page.locator(FOCUSABLE);
  const count = await focusables.count();
  const out = [];
  for (let i = 0; i < count; i++) {
    const target = focusables.nth(i);
    const before = await target.evaluate(getPaint);
    await target.focus();
    const after = await target.evaluate(getPaint);
    await target.evaluate(function (node) {
      node.blur();
    });

    // Compare each element of the cell before and after focus
    const colors = [];
    let changed = false;
    let browserRing = false;
    after.parts.forEach(function (now, index) {
      const was = before.parts[index];
      const drawn = now.outlineStyle !== 'none' && parseFloat(now.outlineWidth) > 0;
      browserRing = browserRing || (drawn && now.outlineStyle === 'auto');
      if (drawn && (now.outlineStyle !== was.outlineStyle || now.outlineColor !== was.outlineColor || now.outlineWidth !== was.outlineWidth)) {
        changed = true;
        colors.push(now.outlineColor);
      }
      changed = changed || now.borderWidth !== was.borderWidth;
      for (const key of ['borderColor', 'fill']) {
        if (now[key] !== was[key] && !TRANSPARENT.test(now[key])) {
          changed = true;
          colors.push(now[key]);
        }
      }
      const rings = getRingColors(was.shadow);
      for (const color of getRingColors(now.shadow)) {
        if (!rings.includes(color)) {
          changed = true;
          colors.push(color);
        }
      }
    });
    out.push({ state: before.state, colors: Array.from(new Set(colors)), changed: changed, browserRing: browserRing });
  }
  expect(errors).toEqual([]);

  return out;

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
    const own = await getOwnFocusColors(page, profile);
    const brand = [toRgb(ACME['color.focus']), toRgb(ACME['color.interactive'])];
    expect(own.filter(function (color) {
      return brand.includes(color);
    }), 'the brand focus colors differ from the template\'s own').toEqual([]);
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

      // Every enabled focusable part shows its focus, and where the template draws focus in its
      // own focus or interactive color, the brand's color is drawn instead. Each template draws
      // focus its own way (an outline ring, a border with an inset ring and a page-color line,
      // a thicker field outline, a state color on the box), so the same parts are focused without
      // the brand first: a color the template's focus draws there that is its own focus or
      // interactive color must become the brand's. Focus never draws the browser's own ring
      const unbranded = await getFocusDrawn(page, '/showcase/' + family + '?profile=' + profile, family);
      const branded = await getFocusDrawn(page, '/showcase/' + family + '?profile=' + profile + '&brand=acme', family);
      expect(branded.map(function (entry) {
        return entry.state;
      }), family + ': the same focusable parts with and without the brand').toEqual(unbranded.map(function (entry) {
        return entry.state;
      }));
      branded.forEach(function (entry, index) {
        const label = family + ' / ' + entry.state + ': ';
        reached.focusables += entry.colors.some(function (color) {
          return brand.includes(color);
        }) ? 1 : 0;
        if (!entry.changed) {
          wrong.push(label + 'focus draws nothing');
        }
        if (entry.browserRing) {
          wrong.push(label + 'focus draws the browser ring');
        }
        const leaked = entry.colors.filter(function (color) {
          return own.includes(color);
        });
        if (leaked.length > 0) {
          wrong.push(label + 'focus still draws the template color ' + JSON.stringify(leaked));
        }
        const expectsBrand = unbranded[index].colors.some(function (color) {
          return own.includes(color);
        });
        if (expectsBrand && !entry.colors.some(function (color) {
          return brand.includes(color);
        })) {
          wrong.push(label + 'focus draws ' + JSON.stringify(entry.colors) + ', not the brand color');
        }
      });
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
