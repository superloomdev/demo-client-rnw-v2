// Info: Focus color reach follows the painted surface's semantic role.
// Equal default RGB values do not make inverse focus an alias of normal focus.
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
  const previous = inverse ? own.normal.concat(own.inverseFocus) : own.normal;
  const expected = inverse ? branded.normal.concat(branded.inverseFocus) : branded.normal;
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
