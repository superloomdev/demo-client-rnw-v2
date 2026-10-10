// Info: Walker report, as pure data. Built from the theme controller and the
// measured cells so the native gate compares identical fields on iOS,
// Android and web. No framework is read here, so the Node test host can
// assert the shape directly.


// A small token sample the report carries so a brand layer's reach is
// visible in the artifact without shipping the whole theme
const TOKEN_SAMPLE = ['color.interactive', 'color.focus', 'shape.radius_04', 'shape.radius_08', 'font.family.sans'];


/********************************************************************
Build the walker report.

@param {Object} input           - Everything the report states
@param {Object} input.ctx       - Theme controller (built, theme, fallbacks, names)
@param {String} input.platform  - 'web' | 'ios' | 'android'
@param {Array}  input.catalog   - The library's catalog
@param {Array}  input.cells     - [{ component, state, width, height }]
@param {Array}  input.errors    - [{ component, state, message }]
@param {String} [input.family]  - The walked family, when one was requested
@param {Number} [input.gridWidth] - The measured width of the cells grid

@return {Object} - The report
*********************************************************************/
export function buildReport (input) {

  // Init the theme's font roles: what the theme names, what is drawn
  const named = input.ctx.built.tokens;
  const drawn = input.ctx.theme;
  const fonts = Object.keys(named).filter(function (key) {
    return key.indexOf('font.family.') === 0;
  }).sort().map(function (role) {
    return { role: role, family: named[role], drawn: drawn[role], loaded: drawn[role] === named[role] };
  });

  // Init the token sample
  const tokens = {};
  for (const name of TOKEN_SAMPLE) {
    tokens[name] = drawn[name];
  }

  // Return the report
  return {
    schema: 1,
    platform: input.platform,
    theme: input.ctx.profileName,
    scheme: input.ctx.schemeName,
    brand: input.ctx.brandName || null,
    family: input.family || null,
    components: input.catalog.map(function (entry) {
      return entry.name;
    }),
    expectedCells: input.catalog.reduce(function (sum, entry) {
      return sum + entry.sample.length;
    }, 0),
    cells: input.cells,
    errors: input.errors,
    fonts: fonts,
    gridWidth: input.gridWidth || 0,
    tokens: tokens
  };

}
