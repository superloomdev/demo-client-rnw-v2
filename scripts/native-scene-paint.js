// Info: A native geometry pass must not hide an unthemed page behind it.
// Probe the empty left scene margin, clear of rounded screen corners and
// status/navigation bars. Luminance tolerates small screenshot color-space
// differences, not a white page substituted for a dark theme.
const LUMA_TOLERANCE = 0.02;
// These scenes have no intentionally open sample overlays over the margin.
export const NATIVE_SCENE_FAMILIES = Object.freeze(['Form', 'RadioButton', 'Select']);

function luminance (rgb) {
  const values = rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

export function assertNativeScenePaint (png, background) {
  if (typeof background !== 'string' || !/^#[0-9a-f]{6}$/i.test(background)) {
    throw new TypeError('native scene paint requires the report actual opaque background token');
  }
  if (!(png.width > 0 && png.height > 0) || png.data.length !== png.width * png.height * 4) {
    throw new TypeError('native scene paint requires a decoded RGBA screenshot');
  }
  const expected = [1, 3, 5].map(at => parseInt(background.slice(at, at + 2), 16));
  const target = luminance(expected);
  const x = Math.min(1, png.width - 1);
  for (const fraction of [0.25, 0.5, 0.75]) {
    const y = Math.floor((png.height - 1) * fraction);
    const at = (y * png.width + x) * 4;
    const actual = Array.from(png.data.slice(at, at + 3));
    if (png.data[at + 3] !== 255 || Math.abs(luminance(actual) - target) > LUMA_TOLERANCE) {
      throw new Error('native scene background at ' + x + ',' + y + ': ' + JSON.stringify(actual) + ' is not the themed page ' + background);
    }
  }
}
