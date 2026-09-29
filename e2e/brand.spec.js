// Info: Brand-layer reach. The `acme` layer is sparse; every token it sets
// must reach what the host renders under every profile: its three glyphs in
// the drawn icons, and its color, family and radii in the built theme the
// walker reports. A brand that needs a component change to show is a
// component defect, not a bigger layer.
import { expect, test } from '@playwright/test';

import { BRAND_LAYERS } from '../src/themes/brand-layers.js';
import { PROFILES, openPage, waitForFamily } from './helpers/showcase.js';

const ACME = BRAND_LAYERS.acme.tokens;


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
