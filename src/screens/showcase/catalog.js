// Info: Showcase helpers over the component library's catalog: group the
// built components by roster family, merge the roster's 206 rows with the
// nine planned rows, and carry the theme selection from one page to the
// next.
import { PLANNED_ROWS } from './planned-rows.js';

// The roster's JSON imports statically: the bundlers read .json natively,
// and the test host's resolve hook answers the attribute Node's ESM wants
import roster from '@superloomdev/rnw-components/data/roster.json';


/********************************************************************
Group catalog entries by family, keeping catalog (roster build) order.

@param {Array} catalog - The library's catalog

@return {Array} - [{ family, components: [entry] }]
*********************************************************************/
export function getFamilies (catalog) {

  // Collect each family in first-seen order
  const order = [];
  const byFamily = {};
  for (const entry of catalog) {
    if (byFamily[entry.family] === undefined) {
      byFamily[entry.family] = [];
      order.push(entry.family);
    }
    byFamily[entry.family].push(entry);
  }

  // Return one group per family
  return order.map(function (family) {
    return { family: family, components: byFamily[family] };
  });

}


/********************************************************************
Merge the built catalog with the roster's rows plus the planned rows:
one group per family in roster order (the planned rows' Mobile family
last), each row carrying the catalog entry when the component is built.

@param {Array} catalog - The library's catalog

@return {Array} - [{ family, rows: [{ name, status, entry | null, row }], built, total }]
*********************************************************************/
export function getRoster (catalog) {

  // Index the catalog entries by name
  const byName = {};
  for (const entry of catalog) {
    byName[entry.name] = entry;
  }

  // Group every row - roster order, the nine planned rows appended last
  const order = [];
  const byFamily = {};
  const allRows = roster.rows.concat(PLANNED_ROWS);
  for (const row of allRows) {
    if (byFamily[row.family] === undefined) {
      byFamily[row.family] = [];
      order.push(row.family);
    }
    const entry = byName[row.name] || null;
    byFamily[row.family].push({
      name: row.name,
      status: entry ? 'built' : 'pending',
      entry: entry,
      row: row
    });
  }

  // Return one group per family with its built and total counts
  return order.map(function (family) {
    const rows = byFamily[family];
    return {
      family: family,
      rows: rows,
      built: rows.filter(function (row) {
        return row.status === 'built';
      }).length,
      total: rows.length
    };
  });

}


/********************************************************************
Sum the built and total counts over the roster groups.

@param {Array} groups - getRoster output

@return {Object} - { built, total }
*********************************************************************/
export function getTotals (groups) {

  return {
    built: groups.reduce(function (sum, group) {
      return sum + group.built;
    }, 0),
    total: groups.reduce(function (sum, group) {
      return sum + group.total;
    }, 0)
  };

}


/********************************************************************
Append the current theme selection to an app path.

@param {String} path - e.g. '/showcase/Icon'
@param {Object} ctx  - Theme controller (profileName, schemeName, brandName)

@return {String} - path?profile=..&scheme=..[&brand=..]
*********************************************************************/
export function getHref (path, ctx) {

  // Always carry profile and scheme; carry the explorer's other parameters
  // only when they diverge from the defaults
  const query = ['profile=' + encodeURIComponent(ctx.profileName), 'scheme=' + encodeURIComponent(ctx.schemeName)];
  if (ctx.brandName) {
    query.push('brand=' + encodeURIComponent(ctx.brandName));
  }
  if (ctx.form) {
    query.push('form=' + encodeURIComponent(ctx.form));
  }
  if (ctx.adaptive === 'fixed') {
    query.push('adaptive=fixed');
  }
  if (ctx.textScale !== undefined && ctx.textScale !== null && ctx.textScale !== 1) {
    query.push('textScale=' + encodeURIComponent(ctx.textScale));
  }
  if (ctx.dir === 'rtl') {
    query.push('dir=rtl');
  }

  // Return the path with its query
  return path + '?' + query.join('&');

}
