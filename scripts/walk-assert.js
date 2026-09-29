// Info: Asserts walker reports for the native gate. For each template's
// report on the platform: zero render errors, one measured cell per catalog
// sample state, every cell larger than zero, and the sans family the theme
// names actually drawn (the serif and mono roles are listed, not failed,
// until the hosts carry those families). With `--web <dir>`, every cell's
// size must equal the web walker's within one point: the same tokens produce
// the same numbers on every platform.
//
// Usage: node scripts/walk-assert.js --platform ios|android --dir <dir>
//          [--web <dir>] [--themes default,carbon,material]
// Exit 1 on any failure; prints one PASS/FAIL line per check.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = function (flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};
const PLATFORM = arg('--platform', '');
const DIR = resolve(arg('--dir', 'walk-out'));
const WEB = arg('--web', null);
const THEMES = arg('--themes', 'default,carbon,material').split(',');
const TOLERANCE = 1;

const failures = [];
const warnings = [];


/********************************************************************
Record one check.

@param {Boolean} ok      - Whether it passed
@param {String}  message - What was checked
*********************************************************************/
function check (ok, message) {

  process.stdout.write((ok ? 'PASS ' : 'FAIL ') + message + '\n');
  if (!ok) {
    failures.push(message);
  }

}


for (const theme of THEMES) {

  // The report must exist and parse
  const file = join(DIR, PLATFORM + '-' + theme + '.json');
  if (!existsSync(file)) {
    check(false, theme + ': report ' + file + ' exists');
    continue;
  }
  const report = JSON.parse(readFileSync(file, 'utf8'));

  // Identity, errors, coverage and sizes
  check(report.platform === PLATFORM && report.theme === theme, theme + ': report is for ' + PLATFORM + ' / ' + theme);
  check(Array.isArray(report.errors) && report.errors.length === 0, theme + ': zero render errors ' + JSON.stringify(report.errors));
  check(report.cells.length === report.expectedCells, theme + ': ' + report.cells.length + ' of ' + report.expectedCells + ' cells measured');
  const empty = report.cells.filter(function (cell) {
    return !(cell.width > 0 && cell.height > 0);
  });
  check(empty.length === 0, theme + ': every cell has a size ' + JSON.stringify(empty));

  // Fonts: sans must be drawn as named; the others are reported
  check(report.fonts.length >= 1, theme + ': font roles reported');
  for (const font of report.fonts) {
    if (font.role === 'font.family.sans') {
      check(font.loaded === true, theme + ': ' + font.role + ' "' + font.family + '" drawn as named (drawn "' + font.drawn + '")');
    } else if (!font.loaded) {
      warnings.push(theme + ': ' + font.role + ' "' + font.family + '" not carried by the host; drawn in "' + font.drawn + '"');
    }
  }

  // Geometry against the web walker
  if (WEB) {
    const webFile = join(resolve(WEB), 'web-' + theme + '.json');
    if (!existsSync(webFile)) {
      check(false, theme + ': web report ' + webFile + ' exists');
      continue;
    }
    const web = JSON.parse(readFileSync(webFile, 'utf8'));
    const webCells = {};
    for (const cell of web.cells) {
      webCells[cell.component + '/' + cell.state] = cell;
    }
    for (const cell of report.cells) {
      const key = cell.component + '/' + cell.state;
      const other = webCells[key];
      const ok = other !== undefined && Math.abs(cell.width - other.width) <= TOLERANCE && Math.abs(cell.height - other.height) <= TOLERANCE;
      check(ok, theme + ': ' + key + ' ' + cell.width + 'x' + cell.height + ' vs web ' + (other ? other.width + 'x' + other.height : 'missing'));
    }
  }

}

for (const line of warnings) {
  process.stdout.write('WARN ' + line + '\n');
}
process.stdout.write('walk-assert: ' + PLATFORM + ' ' + (failures.length === 0 ? 'passed' : failures.length + ' failure(s)') + ', ' + warnings.length + ' warning(s)\n');
process.exit(failures.length === 0 ? 0 : 1);
