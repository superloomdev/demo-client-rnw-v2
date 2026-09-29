// Info: Showcase helpers over the component library's catalog: group the
// built components by roster family and carry the theme selection from one
// page to the next.


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
Append the current theme selection to an app path.

@param {String} path - e.g. '/showcase/Icon'
@param {Object} ctx  - Theme controller (profileName, schemeName, brandName)

@return {String} - path?profile=..&scheme=..[&brand=..]
*********************************************************************/
export function getHref (path, ctx) {

  // Always carry profile and scheme; carry brand only when one is set
  const query = ['profile=' + encodeURIComponent(ctx.profileName), 'scheme=' + encodeURIComponent(ctx.schemeName)];
  if (ctx.brandName) {
    query.push('brand=' + encodeURIComponent(ctx.brandName));
  }

  // Return the path with its query
  return path + '?' + query.join('&');

}
