// Info: Brand layer definitions for the demo application. A brand layer is a
// sparse overlay the Themer merges on top of whichever scheme is selected:
// switching schemes replaces the base, switching brands changes only the
// overlay, and no template is ever rebuilt for a brand.

export const BRAND_LAYERS = {

  // Rounded: two tokens. `feedback.field` switches fields to four-sided
  // borders and `shape.radius_00` rounds every square corner together, so
  // fields, buttons, tiles, notifications and menus move as one. If a
  // component needs a code change to look right under this layer, the
  // component hard-coded structure and is fixed; the layer never grows.
  rounded: {
    name: 'rounded',
    tokens: {
      'feedback.field': 'outline',
      'shape.radius_00': 8
    }
  }

};

export default BRAND_LAYERS;
