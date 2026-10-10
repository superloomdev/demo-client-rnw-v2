// Info: Shared e2e helpers: the library catalog as the host installed it,
// page opening with error collection, and the accessibility-tree serializer
// the identity test compares across profiles.
import { expect } from '@playwright/test';

import { catalog } from '../../hosts/web/node_modules/@superloomdev/rnw-components/catalog.js';

export { catalog };

export const PROFILES = ['default', 'carbon', 'material'];

// Families in catalog order
export const FAMILIES = catalog.reduce(function (out, entry) {
  if (!out.includes(entry.family)) {
    out.push(entry.family);
  }
  return out;
}, []);


/********************************************************************
Open a path and collect every page error, console error, failed
request and 4xx/5xx response while it loads.

@param {Object} page - Playwright page
@param {String} path - Path with query

@return {Promise<Array>} - The collected errors (live array)
*********************************************************************/
export async function openPage (page, path) {

  const errors = [];
  page.on('pageerror', function (error) {
    errors.push('pageerror: ' + error.message);
  });
  page.on('console', function (message) {
    if (message.type() === 'error') {
      errors.push('console: ' + message.text());
    }
  });
  page.on('requestfailed', function (request) {
    errors.push('requestfailed: ' + request.url() + ' ' + (request.failure() ? request.failure().errorText : ''));
  });
  page.on('response', function (response) {
    if (response.status() >= 400) {
      errors.push('http ' + response.status() + ': ' + response.url());
    }
  });
  await page.goto(path);

  return errors;

}


/********************************************************************
Wait until a family page has rendered every cell it should.

@param {Object} page   - Playwright page
@param {String} family - Family name

@return {Promise<Number>} - The expected cell count
*********************************************************************/
export async function waitForFamily (page, family) {

  const expected = catalog.filter(function (entry) {
    return entry.family === family;
  }).reduce(function (sum, entry) {
    return sum + entry.sample.filter(function (state) {
      return state.cell !== false;
    }).length;
  }, 0);
  await expect(page.locator('[data-cell="true"]')).toHaveCount(expected, { timeout: 20000 });

  return expected;

}


/********************************************************************
Serialize the accessibility tree of every cell body: tag, role, aria-*,
tabindex, disabled and text per element; an svg is one leaf.

@param {Object} page - Playwright page

@return {Promise<Object>} - "Component/state" -> lines
*********************************************************************/
export async function getA11yTrees (page) {

  return page.evaluate(function () {
    const out = {};
    for (const cell of document.querySelectorAll('[data-cell="true"]')) {
      const lines = [];
      const walk = function (node, depth) {
        const parts = [node.tagName.toLowerCase()];
        const names = Array.from(node.attributes).map(function (attribute) {
          return attribute.name;
        }).filter(function (name) {
          return name === 'role' || name.indexOf('aria-') === 0 || name === 'tabindex' || name === 'disabled';
        }).sort();
        for (const name of names) {
          parts.push(name + '=' + node.getAttribute(name));
        }
        const text = Array.from(node.childNodes).filter(function (child) {
          return child.nodeType === 3;
        }).map(function (child) {
          return child.textContent.trim();
        }).filter(Boolean).join(' ');
        if (text) {
          parts.push('text=' + JSON.stringify(text));
        }
        lines.push('  '.repeat(depth) + parts.join(' '));
        if (node.tagName.toLowerCase() === 'svg') {
          return;
        }
        for (const child of node.children) {
          walk(child, depth + 1);
        }
      };
      for (const child of cell.querySelector('[data-part="body"]').children) {
        walk(child, 0);
      }
      out[cell.getAttribute('data-component') + '/' + cell.getAttribute('data-state')] = lines;
    }
    return out;
  });

}
