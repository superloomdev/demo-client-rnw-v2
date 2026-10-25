// Info: The three sample screens end to end: readiness under every
// template and form-class width, the shared explorer state carrying the
// text scale across routes, and the records screen's search, menu and
// dialog behavior.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { openPage, waitForBuild } from './helpers/showcase.js';

const OUT = join(process.cwd(), 'test-results', 'showcase', 'samples');
const SCREENS = ['sign-in', 'settings', 'records'];
const PROFILES = ['default', 'carbon', 'material'];
const WIDTHS = [375, 768, 1280];


for (const screen of SCREENS) {
  for (const profile of PROFILES) {
    for (const width of WIDTHS) {
      test(screen + ' / ' + profile + ' / ' + width + ': readiness, zero errors, screenshot', async function ({ page }) {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize({ width: width, height: 720 });
        const errors = await openPage(page, '/samples/' + screen + '?profile=' + profile);
        await expect(page.getByTestId('sample-' + screen).first()).toBeVisible({ timeout: 15000 });
        if (screen === 'settings') {
          // The skeleton prelude is a state of its own: it must be present
          // on arrival, then gone once the loaded scene mounts
          await expect(page.getByTestId('sample-settings-skeleton')).toBeVisible();
          await page.getByTestId('sample-settings-loaded').waitFor();
          await expect(page.getByTestId('sample-settings-skeleton')).toHaveCount(0);
        } else {
          await page.waitForTimeout(900);
        }
        await page.screenshot({ path: join(OUT, screen + '-' + profile + '-' + width + '.png'), fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('the settings text-scale slider doubles the sign-in heading through shared explorer state', async function ({ page }) {
  // Read the heading's size at scale 1 on the sign-in screen
  await page.setViewportSize({ width: 1280, height: 720 });
  await openPage(page, '/samples/sign-in?profile=carbon');
  const base = await page.evaluate(function () {
    const headings = Array.from(document.querySelectorAll('[role="heading"]'));
    return parseFloat(window.getComputedStyle(headings[0]).fontSize);
  });
  // Move the text-scale slider to its maximum on the settings screen;
  // the selection is the explorer's own state, carried through the URL
  const errors = await openPage(page, '/samples/settings?profile=carbon');
  await expect(page.getByTestId('sample-settings').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  const slider = page.getByRole('slider').first();
  await slider.focus();
  await slider.press('End');
  // The scene root reports the build: the slider reached 2 before leaving
  await waitForBuild(page, '[data-testid="sample-settings"]', { textScale: '2' });
  // The shared explorer state carries textScale to the next route
  await openPage(page, '/samples/sign-in?profile=carbon&textScale=2');
  await waitForBuild(page, '[data-testid="sample-sign-in"]', { textScale: '2' });
  const scaled = await page.evaluate(function () {
    const headings = Array.from(document.querySelectorAll('[role="heading"]'));
    return parseFloat(window.getComputedStyle(headings[0]).fontSize);
  });
  expect(errors).toEqual([]);
  expect(scaled).toBe(base * 2);
});

test('the records screen searches, opens the overflow menu and the detail modal', async function ({ page }) {
  const errors = await openPage(page, '/samples/records?profile=carbon');
  await expect(page.getByTestId('sample-records').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);

  // The search narrows the list to the one matching record
  const search = page.getByRole('searchbox').or(page.getByRole('textbox')).first();
  await search.fill('atlas');
  expect(await page.getByTestId('record-0').count()).toBe(1);
  expect(await page.getByTestId('record-1').count()).toBe(0);
  await expect(page.getByTestId('records-page')).toContainText('Page 1 of 1');

  // Clearing the search restores the page
  await search.fill('');
  expect(await page.getByTestId('record-4').count()).toBe(1);

  // The overflow button opens the built menu; Escape closes it
  await page.getByRole('button', { name: 'more' }).first().click();
  await expect(page.getByRole('menu').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // A title opens the record's modal; Escape closes it
  await page.getByTestId('record-title-0').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
