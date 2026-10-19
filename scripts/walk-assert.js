// Info: Asserts walker reports for the native gate. For each template's
// report on the platform: zero render errors, one measured cell per catalog
// sample state, every cell larger than zero, and the sans and mono families
// the theme names actually drawn (the serif role is listed, not failed,
// until the hosts carry it). With `--web <dir>`, the web report must have
// drawn the same families (a baseline measured in a fallback face is no
// baseline), and every cell must match the web walker's: height within one
// point, width within two. The same tokens and the same font files produce
// the same boxes on every platform; the width margin is pixel rounding only,
// because each platform rounds a text run up to its own pixel grid (the web
// and Android to whole points, iOS to thirds) once per side. A face that is
// not drawn moves a label by several points, a collapsed field by a hundred.
// The web baseline is walked at each platform's own grid width: a cell whose
// width is capped by its host re-lays out with the room, so the reference
// must have seen the same room - a grid-width mismatch fails before any
// cell is read.
//
// Usage: node scripts/walk-assert.js --platform ios|android --dir <dir>
//          [--web <dir>] [--themes default,carbon,material]
//          [--schemes light,dark]
// Exit 1 on any failure; prints one PASS/FAIL line per check.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { reportName, walkCases } from './walk-matrix.js';

const arg = function (flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};
const PLATFORM = arg('--platform', '');
const DIR = resolve(arg('--dir', 'walk-out'));
const WEB = arg('--web', null);
const THEMES = arg('--themes', 'default,carbon,material').split(',');
const CASES = walkCases(THEMES, arg('--schemes', 'light,dark').split(','));
const TOLERANCE = 1;
const WIDTH_TOLERANCE = 2;
// Font roles whose family must be drawn as named; the others are reported
const REQUIRED_FONTS = ['font.family.sans', 'font.family.mono'];

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


for (const entry of CASES) {
  const theme = entry.theme;
  const scheme = entry.scheme;

  // The report must exist and parse
  const file = join(DIR, reportName({ platform: PLATFORM, theme: theme, scheme: scheme }));
  if (!existsSync(file)) {
    check(false, theme + ': report ' + file + ' exists');
    continue;
  }
  const report = JSON.parse(readFileSync(file, 'utf8'));

  // Identity, errors, coverage and sizes
  check(report.platform === PLATFORM && report.theme === theme && report.scheme === scheme,
    theme + ': report is for ' + PLATFORM + ' / ' + theme + ' / ' + scheme);
  check(Array.isArray(report.errors) && report.errors.length === 0, theme + ': zero render errors ' + JSON.stringify(report.errors));
  check(report.cells.length === report.expectedCells, theme + ': ' + report.cells.length + ' of ' + report.expectedCells + ' cells measured');
  const empty = report.cells.filter(function (cell) {
    return !(cell.width > 0 && cell.height > 0);
  });
  check(empty.length === 0, theme + ': every cell has a size ' + JSON.stringify(empty));

  // Fonts: sans and mono must be drawn as named; the others are reported
  check(report.fonts.length >= 1, theme + ': font roles reported');
  for (const font of report.fonts) {
    if (REQUIRED_FONTS.includes(font.role)) {
      check(font.loaded === true, theme + ': ' + font.role + ' "' + font.family + '" drawn as named (drawn "' + font.drawn + '")');
    } else if (!font.loaded) {
      warnings.push(theme + ': ' + font.role + ' "' + font.family + '" not carried by the host; drawn in "' + font.drawn + '"');
    }
  }

  // Geometry against the web walker
  if (WEB) {
    const webFile = join(resolve(WEB), reportName({ platform: 'web', theme: theme, scheme: scheme }));
    if (!existsSync(webFile)) {
      check(false, theme + ': web report ' + webFile + ' exists');
      continue;
    }
    const web = JSON.parse(readFileSync(webFile, 'utf8'));
    check(web.platform === 'web' && web.theme === theme && web.scheme === scheme,
      theme + ': web baseline is the same theme and scheme ' + scheme);
    for (const font of web.fonts.filter(function (entry) {
      return REQUIRED_FONTS.includes(entry.role);
    })) {
      check(font.loaded === true, theme + ': web baseline drew ' + font.role + ' "' + font.family + '" as named (drawn "' + font.drawn + '")');
    }
    const webCells = {};
    for (const cell of web.cells) {
      webCells[cell.component + '/' + cell.state] = cell;
    }
    // The reference must have been walked at this platform's own grid
    // width: a different room re-lays out responsive cells, so the
    // comparison below would pair unlike boxes
    if (web.gridWidth !== report.gridWidth) {
      check(false, theme + ': web gridWidth ' + web.gridWidth + ' != native ' + report.gridWidth + ': not the same room');
      continue;
    }
    for (const cell of report.cells) {
      const key = cell.component + '/' + cell.state;
      const other = webCells[key];
      const ok = other !== undefined && Math.abs(cell.width - other.width) <= WIDTH_TOLERANCE &&
        Math.abs(cell.height - other.height) <= TOLERANCE;
      check(ok, theme + ': ' + key + ' ' + cell.width + 'x' + cell.height + ' vs web ' + (other ? other.width + 'x' + other.height : 'missing'));
    }
  }

}

for (const line of warnings) {
  process.stdout.write('WARN ' + line + '\n');
}
process.stdout.write('walk-assert: ' + PLATFORM + ' ' + (failures.length === 0 ? 'passed' : failures.length + ' failure(s)') + ', ' + warnings.length + ' warning(s)\n');
process.exit(failures.length === 0 ? 0 : 1);
