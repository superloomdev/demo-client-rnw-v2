// Info: The native parity cases use actual profile scheme IDs, not an
// implicit first scheme. Every producer and consumer shares this identity.
export const WALK_CASES = Object.freeze([
  Object.freeze({ theme: 'default', mode: 'light', scheme: 'light' }),
  Object.freeze({ theme: 'default', mode: 'dark', scheme: 'dark' }),
  Object.freeze({ theme: 'carbon', mode: 'light', scheme: 'white' }),
  Object.freeze({ theme: 'carbon', mode: 'dark', scheme: 'g100' }),
  Object.freeze({ theme: 'material', mode: 'light', scheme: 'light' }),
  Object.freeze({ theme: 'material', mode: 'dark', scheme: 'dark' })
]);

/********************************************************************
Select explicit parity cases; unknown names must never silently skip.

@param {Array} themes - Selected template names
@param {Array} modes  - light and/or dark
@return {Array} - Matching immutable cases
*********************************************************************/
export function walkCases (themes, modes) {
  for (const theme of themes) {
    if (!WALK_CASES.some(item => item.theme === theme)) {
      throw new TypeError('walk: unknown theme ' + theme);
    }
  }
  for (const mode of modes) {
    if (mode !== 'light' && mode !== 'dark') {
      throw new TypeError('walk: unknown scheme mode ' + mode);
    }
  }
  if (themes.length === 0 || modes.length === 0) {
    throw new TypeError('walk: the case selection must not be empty');
  }
  return WALK_CASES.filter(item => themes.includes(item.theme) && modes.includes(item.mode));
}

/********************************************************************
Name one report without mixing schemes or permitting path traversal.

@param {Object} report - platform, theme, scheme, optional brand/family
@return {String} - Evidence filename
*********************************************************************/
export function reportName (report) {
  const identity = [report.platform, report.theme, report.scheme];
  if (report.brand) {
    identity.push(report.brand);
  }
  if (report.family) {
    identity.push(report.family);
  }
  if (identity.some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value))) {
    throw new TypeError('walk: report identity requires safe platform, theme and explicit scheme names');
  }
  return identity.join('-') + '.json';
}
