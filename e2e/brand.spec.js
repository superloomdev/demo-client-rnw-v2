// Info: Brand-layer reach. The `acme` layer is sparse; every token it sets
// must reach what the host renders under every profile: its three glyphs in
// the drawn icons, its color, family and radii in the built theme the
// walker reports, and, in every rendered component, its family on every
// drawn text, its focus and interactive colors on whatever focus draws on
// every focusable part and its radius on a corner that names it. A brand that needs a component change to show is a
// component defect, not a bigger layer.
import { expect, test } from '@playwright/test';

import { BRAND_LAYERS } from '../src/themes/brand-layers.js';
import { focusBrandIssues } from './helpers/focus-brand.js';
import { FAMILIES, PROFILES, catalog, openPage, waitForFamily } from './helpers/showcase.js';

const ACME = BRAND_LAYERS.acme.light.tokens;

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
const FOCUSABLE = '[data-cell="true"] :is([role="button"], [role="checkbox"], [role="combobox"], input):not([aria-disabled="true"]):not([disabled]):not([aria-hidden="true"]):not([aria-hidden="true"] *):visible';
// A computed color with zero alpha
const TRANSPARENT = /^rgba\(.*, 0\)$/;


/********************************************************************
The focus and interactive colors a profile draws without a brand, as the
walker reports its built theme.

@param {Object} page    - Playwright page
@param {String} profile - Profile name

@return {Promise<Array>} - [focus, interactive] as `rgb()` strings
*********************************************************************/
async function getOwnFocusColors (page, profile, brand) {

  const errors = await openPage(page, '/walk/Icon?profile=' + profile + (brand ? '&brand=' + brand : ''));
  await expect(page.getByTestId('walk-status')).toContainText('walk: done');
  const tokens = await page.evaluate(function () {
    return globalThis.__walk.tokens;
  });
  expect(errors).toEqual([]);

  return {
    normal: [toRgb(tokens['color.focus']), toRgb(tokens['color.interactive'])],
    inverseFocus: toRgb(tokens['color.focus_inverse']),
    inverseSurface: toRgb(tokens['color.background_inverse'])
  };

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
  const surfaces = [];
  for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
    const color = window.getComputedStyle(ancestor).backgroundColor;
    if (color !== 'rgba(0, 0, 0, 0)') {
      surfaces.push(color);
    }
  }

  return {
    state: cell.getAttribute('data-state'),
    component: cell.getAttribute('data-component'),
    surfaces: surfaces,
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
    out.push({ state: before.state, component: before.component, surfaces: after.surfaces, colors: Array.from(new Set(colors)), changed: changed, browserRing: browserRing });
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
    const brandedPalette = await getOwnFocusColors(page, profile, 'acme');
    const brand = [toRgb(ACME['color.focus']), toRgb(ACME['color.interactive'])];
    expect(own.normal.filter(function (color) {
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
        const label = family + ' / ' + entry.component + ' / ' + entry.state + ': ';
        reached.focusables += entry.colors.some(function (color) {
          return brand.includes(color);
        }) ? 1 : 0;
        wrong.push.apply(wrong, focusBrandIssues(unbranded[index], entry, own, brandedPalette).map(issue => label + issue));
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


// The template's own sample brands reach the render the same way: carbon's
// `superloom` moves the interactive color to the purple ramp, and
// material's `rounded` opens fields to outlines and rounds square corners
for (const reach of [
  {
    name: 'carbon + superloom',
    query: 'profile=carbon&brand=superloom',
    tokens: { 'color.interactive': '#8a3ffc', 'color.button_primary': '#8a3ffc' },
    family: 'Button'
  },
  {
    name: 'material + rounded',
    query: 'profile=material&brand=rounded',
    tokens: { 'shape.radius_00': 8 },
    family: 'Tag'
  }
]) {

  test(reach.name + ': the template brand reaches the built theme', async function ({ page }) {
    const errors = await openPage(page, '/walk/Icon?' + reach.query);
    await expect(page.getByTestId('walk-status')).toContainText('walk: done');
    const report = await page.evaluate(function () {
      return globalThis.__walk;
    });
    expect(errors).toEqual([]);
    for (const name of Object.keys(reach.tokens)) {
      expect(report.tokens[name] !== undefined ? report.tokens[name] : 'unsampled', name + ' sampled in the report').not.toBe('unsampled');
    }
  });

  test(reach.name + ': the template brand reaches the render', async function ({ page }) {
    const errors = await openPage(page, '/showcase/' + reach.family + '?' + reach.query);
    await page.getByTestId('family-' + reach.family).waitFor();
    const rgb = Object.keys(reach.tokens).filter(function (name) {
      return name.indexOf('color.') === 0;
    }).map(function (name) {
      return toRgb(reach.tokens[name]);
    });
    if (rgb.length > 0) {
      const drawn = await page.evaluate(function (colors) {
        return Array.from(document.querySelectorAll('*')).some(function (node) {
          const style = window.getComputedStyle(node);
          return colors.indexOf(style.backgroundColor) !== -1 || colors.indexOf(style.borderTopColor) !== -1 || colors.indexOf(style.color) !== -1;
        });
      }, rgb);
      expect(drawn, 'a brand color is drawn somewhere on the page').toBe(true);
    }
    if (reach.tokens['shape.radius_00'] !== undefined) {
      const radius = await page.evaluate(function (expected) {
        return Array.from(document.querySelectorAll('[data-cell="true"] *')).map(function (node) {
          return parseFloat(window.getComputedStyle(node).borderTopLeftRadius) || 0;
        }).indexOf(expected) !== -1;
      }, reach.tokens['shape.radius_00']);
      expect(radius, 'a corner draws the brand radius').toBe(true);
    }
    expect(errors).toEqual([]);
  });

}
