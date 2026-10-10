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
// One honest exception: a cell whose width is capped by its host (a toast
// wider than the room the grid leaves a cell body) is expected to shrink to
// that room, so its bound is min(web width, grid room), never the web width
// alone.
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
const WIDTH_TOLERANCE = 2;
// The room a cell's chrome leaves its body: the cell border twice plus its
// padding twice
const CELL_CHROME = 26;
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
    const webFile = join(resolve(WEB), 'web-' + theme + '.json');
    if (!existsSync(webFile)) {
      check(false, theme + ': web report ' + webFile + ' exists');
      continue;
    }
    const web = JSON.parse(readFileSync(webFile, 'utf8'));
    for (const font of web.fonts.filter(function (entry) {
      return REQUIRED_FONTS.includes(entry.role);
    })) {
      check(font.loaded === true, theme + ': web baseline drew ' + font.role + ' "' + font.family + '" as named (drawn "' + font.drawn + '")');
    }
    const webCells = {};
    for (const cell of web.cells) {
      webCells[cell.component + '/' + cell.state] = cell;
    }
    // The widest a cell body can be on this device: a wider measure means
    // the component was capped by its host, not collapsed
    const room = report.gridWidth > 0 ? report.gridWidth - CELL_CHROME : 0;
    for (const cell of report.cells) {
      const key = cell.component + '/' + cell.state;
      const other = webCells[key];
      const bound = other === undefined || room === 0 ? (other ? other.width : 0) : Math.min(other.width, room);
      const ok = other !== undefined && cell.width >= bound - WIDTH_TOLERANCE &&
        cell.width <= other.width + WIDTH_TOLERANCE &&
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
