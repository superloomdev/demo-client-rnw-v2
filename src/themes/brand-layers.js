// Info: Brand layers the demo adds on top of what each template package
// ships. A brand layer is a sparse overlay the Themer merges on top of
// whichever scheme is selected: switching schemes replaces the base,
// switching brands changes only the overlay, and no template is ever
// rebuilt for a brand.
//
// Shape: per polarity, { name, light: { tokens }, dark: { tokens } } - the
// same shape the template packages export under `template.brands`. The
// applied layer is `brand[polarity]` of the built scheme.

const ACME_TOKENS = {
  'color.interactive': '#c2410c',
  'color.focus': '#c2410c',
  'font.family.sans': 'Roboto',
  'shape.radius_04': 6,
  'shape.radius_08': 12,
  'icon.close': { icon: true, viewBox: '0 0 24 24', paths: [{ d: 'M5 5h3l4 5 4-5h3l-5.5 7 5.5 7h-3l-4-5-4 5H5l5.5-7z' }] },
  'icon.checkmark': { icon: true, viewBox: '0 0 24 24', paths: [{ d: 'M3 12l2-2 5 5 9-9 2 2-11 11z' }] },
  'icon.search': { icon: true, viewBox: '0 0 24 24', paths: [{ d: 'M10 3a7 7 0 015.6 11.2l5.2 5.2-1.4 1.4-5.2-5.2A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z' }] }
};

export const BRAND_LAYERS = {

  // Acme: a sparse brand over any profile. One interactive color and its
  // focus ring, a sans family the hosts carry, two radii, and three glyphs
  // of its own. Every token is one the contract already has, so no
  // component changes; the e2e brand test proves each one reaches the
  // render. The same tokens answer both polarities.
  acme: {
    name: 'acme',
    light: { tokens: ACME_TOKENS },
    dark: { tokens: ACME_TOKENS }
  }

};

export default BRAND_LAYERS;
