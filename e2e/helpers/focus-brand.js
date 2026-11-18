// Info: Focus color reach follows the painted surface's semantic role.
// Equal default RGB values do not make inverse focus an alias of normal focus.
//
// A template color can also share the focus value outright (carbon white
// draws the primary button, and so a calendar day's focus, in the focus
// blue), so a leak is read under the `roles` brand, where every such color
// draws its own: `focusBrandIssues` reads one part under `roles`, whose
// palette lists those colors as `others`, and `focusRoleIssues` holds the
// part to the brand wherever `roles` shows it draws the focus role.
export function focusBrandIssues (before, after, own, branded) {
  const issues = [];
  if (!after.changed) {
    issues.push('focus draws nothing');
  }
  if (after.browserRing) {
    issues.push('focus draws the browser ring');
  }
  const inverse = after.surfaces.includes(branded.inverseSurface);
  // An inverse surface can carry either role (for example a notification's
  // normal focus ring). Do not force every control onto inverse focus.
  // Only the focus and interactive values mark a leak: `roles` proves them
  // unique to their roles (`test-loader.js`), while an inverse focus value
  // can be a surface's too (carbon white: `#ffffff`, the button's inset
  // ring in `$background`, `button/_mixins.scss:137`). An inverse focus
  // that shares the focus value is in `own.normal` already
  const previous = own.normal;
  const expected = (inverse ? branded.normal.concat(branded.inverseFocus) : branded.normal).concat(branded.others || []);
  const leaked = after.colors.filter(color => previous.includes(color) && !expected.includes(color));
  if (leaked.length > 0) {
    issues.push('focus still draws the template color ' + JSON.stringify(leaked));
  }
  if (before.colors.some(color => previous.includes(color)) &&
      !after.colors.some(color => expected.includes(color))) {
    issues.push('focus draws ' + JSON.stringify(after.colors) + ', not the expected role color ' + JSON.stringify(expected));
  }
  return issues;
}

// One part under the brand (`after`) and under `roles` (`roles`): focus
// draws something, never the browser ring, and a part that draws the brand
// focus or interactive color under `roles` draws the brand's under the brand
export function focusRoleIssues (after, roles, branded, rolesPalette) {
  const issues = [];
  if (!after.changed) {
    issues.push('focus draws nothing');
  }
  if (after.browserRing) {
    issues.push('focus draws the browser ring');
  }
  if (roles.colors.some(color => rolesPalette.normal.includes(color)) &&
      !after.colors.some(color => branded.normal.includes(color))) {
    issues.push('focus draws the focus role under roles but ' + JSON.stringify(after.colors) + ' under the brand, not ' + JSON.stringify(branded.normal));
  }
  return issues;
}
