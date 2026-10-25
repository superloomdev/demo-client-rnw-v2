// Info: The theme explorer's URL seam end to end: every explorer
// parameter is a query value the provider reads, so a deep link changes
// the rendered build measurably - a form class moves the press-target
// floor, a text scale doubles a type set, rtl reaches the root direction,
// and adaptive fixed draws the expanded base at a compact width. Each pin
// is an exact rendered value read from the page, never a range.
import { expect, test } from '@playwright/test';

import { openPage, waitForFamily } from './helpers/showcase.js';


/********************************************************************
The computed height in px of the first checkbox's painted row: the
press-target floor as rendered (control.target_min: 48 on compact and
medium, 24 on expanded).

@param {Object} page - Playwright page
@param {String} query - The showcase query
@param {Object} build - The build the measurement expects

@return {Promise<Number>} - px height
*********************************************************************/
async function checkboxHeight (page, query, build) {

  await openPage(page, '/showcase/Checkbox?' + query);
  await waitForFamily(page, 'Checkbox', build);
  return page.evaluate(function () {
    const box = document.querySelector('[data-cell="true"] [role="checkbox"]');
    return Math.round(box.getBoundingClientRect().height * 100) / 100;
  });

}


/********************************************************************
The computed background color of the scene root for a query.

@param {Object} page - Playwright page
@param {String} query - The showcase query

@return {Promise<String>} - `rgb(r, g, b)`
*********************************************************************/
async function sceneBackground (page, query, build) {

  await openPage(page, '/showcase/Button?' + query);
  await waitForFamily(page, 'Button', build);
  return page.evaluate(function () {
    return window.getComputedStyle(document.querySelector('[data-testid="scene"]')).backgroundColor;
  });

}


test('the template parameter selects the theme', async function ({ page }) {
  expect(await sceneBackground(page, 'profile=carbon')).toBe('rgb(255, 255, 255)');
  expect(await sceneBackground(page, 'profile=material')).toBe('rgb(253, 247, 255)');
  // `theme` and `template` alias `profile`
  expect(await sceneBackground(page, 'theme=material')).toBe('rgb(253, 247, 255)');
  expect(await sceneBackground(page, 'template=carbon')).toBe('rgb(255, 255, 255)');
});

test('the scheme parameter selects the scheme inside the profile', async function ({ page }) {
  expect(await sceneBackground(page, 'profile=carbon&scheme=white')).toBe('rgb(255, 255, 255)');
  expect(await sceneBackground(page, 'profile=carbon&scheme=g90')).toBe('rgb(38, 38, 38)');
});

test('the brand parameter applies the profile\'s brand layer', async function ({ page }) {
  // acme names its own interactive color; carbon's own is the blue ramp
  await openPage(page, '/walk/Icon?profile=carbon');
  await expect(page.getByTestId('walk-status')).toContainText('walk: done');
  const base = await page.evaluate(function () {
    return globalThis.__walk.tokens['color.interactive'];
  });
  await openPage(page, '/walk/Icon?profile=carbon&brand=acme');
  await expect(page.getByTestId('walk-status')).toContainText('walk: done');
  const branded = await page.evaluate(function () {
    return globalThis.__walk.tokens['color.interactive'];
  });
  expect(base).toBe('#0f62fe');
  expect(branded).toBe('#c2410c');
});

test('the form parameter resolves the window-independent class', async function ({ page }) {
  // The press-target floor is 48 on compact, 24 on expanded
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await checkboxHeight(page, 'profile=carbon&form=compact', { form: 'compact' })).toBe(48);
  expect(await checkboxHeight(page, 'profile=carbon&form=expanded', { form: 'expanded' })).toBe(24);
});

test('the adaptive parameter ignores the form variant at fixed', async function ({ page }) {
  // At a compact width: auto applies the variant's floor (48), fixed keeps
  // the expanded base (24). The class assertion names the resolved form if
  // the width resolves to a different class than this pin assumes
  await page.setViewportSize({ width: 375, height: 720 });
  await openPage(page, '/showcase/Checkbox?profile=carbon');
  await waitForFamily(page, 'Checkbox');
  await expect(page.locator('[data-testid="family-Checkbox"]')).toHaveAttribute('data-form', 'compact');
  expect(await checkboxHeight(page, 'profile=carbon&adaptive=auto', { form: 'compact', adaptive: 'auto' })).toBe(48);
  expect(await checkboxHeight(page, 'profile=carbon&adaptive=fixed', { form: 'compact', adaptive: 'fixed' })).toBe(24);
});

test('the textScale parameter multiplies type sets', async function ({ page }) {
  // carbon label01: 12px at scale 1, 24px at scale 2 (the theme maximum)
  const read = async function (scale) {
    await openPage(page, '/showcase/Switch?profile=carbon&textScale=' + scale);
    await waitForFamily(page, 'Switch', { textScale: String(scale) });
    return page.evaluate(function () {
      const label = Array.from(document.querySelectorAll('[data-cell="true"] *')).find(function (node) {
        return node.children.length === 0 && node.textContent.trim() === 'Off';
      });
      return window.getComputedStyle(label).fontSize;
    });
  };
  expect(await read(1)).toBe('14px');
  expect(await read(2)).toBe('28px');
});

test('the dir parameter reaches the document direction', async function ({ page }) {
  await openPage(page, '/showcase/Button?profile=carbon');
  await waitForFamily(page, 'Button', { dir: 'ltr' });
  expect(await page.evaluate(function () {
    return document.documentElement.dir;
  })).toBe('ltr');
  await openPage(page, '/showcase/Button?profile=carbon&dir=rtl');
  await waitForFamily(page, 'Button', { dir: 'rtl' });
  expect(await page.evaluate(function () {
    return document.documentElement.dir;
  })).toBe('rtl');
});

test('the explorer strip renders one control per parameter', async function ({ page }) {
  const errors = await openPage(page, '/showcase/Button?profile=carbon');
  await waitForFamily(page, 'Button');
  await expect(page.getByTestId('explorer')).toBeVisible();
  for (const param of ['template', 'scheme', 'brand', 'form', 'textScale']) {
    await expect(page.getByTestId('explorer-' + param)).toBeVisible();
  }
  await expect(page.getByTestId('explorer-adaptive')).toBeVisible();
  await expect(page.getByTestId('explorer-dir')).toBeVisible();
  expect(errors).toEqual([]);
});
