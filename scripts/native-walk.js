// Info: Drives the walker on a booted simulator or emulator for the native
// gate. For each template it opens the walker by deep link with the walk
// server's report URL, waits for the report file, then opens the walker once
// per family and takes a screenshot. The walk server must already be running
// and writing to `--out`.
//
// Usage: node scripts/native-walk.js --platform ios|android --out <dir>
//          [--report-host localhost|10.0.2.2] [--port 8787]
//          [--themes default,carbon,material] [--timeout 180]

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { catalog } from '../hosts/expo/node_modules/@superloomdev/rnw-components/catalog.js';

const arg = function (flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};
const PLATFORM = arg('--platform', '');
const OUT = resolve(arg('--out', 'walk-out'));
const PORT = arg('--port', '8787');
const HOST = arg('--report-host', PLATFORM === 'android' ? '10.0.2.2' : 'localhost');
const THEMES = arg('--themes', 'default,carbon,material').split(',');
const TIMEOUT_S = Number(arg('--timeout', '180'));

if (PLATFORM !== 'ios' && PLATFORM !== 'android') {
  process.stderr.write('native-walk: --platform must be ios or android\n');
  process.exit(2);
}

const FAMILIES = catalog.reduce(function (out, entry) {
  if (!out.includes(entry.family)) {
    out.push(entry.family);
  }
  return out;
}, []);


/********************************************************************
Open a deep link on the booted device.

@param {String} url - nimbus:// link

@return {undefined}
*********************************************************************/
function openLink (url) {

  if (PLATFORM === 'ios') {
    execFileSync('xcrun', ['simctl', 'openurl', 'booted', url], { stdio: 'inherit' });
    return;
  }
  execFileSync('adb', ['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', '"' + url + '"'], { stdio: 'inherit' });

}


/********************************************************************
Screenshot the booted device into a PNG file.

@param {String} file - Output path

@return {undefined}
*********************************************************************/
function screenshot (file) {

  if (PLATFORM === 'ios') {
    execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', file], { stdio: 'inherit' });
    return;
  }
  writeFileSync(file, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));

}


/********************************************************************
Wait for a file to appear.

@param {String} file    - Path
@param {Number} seconds - Timeout

@return {Promise<Boolean>} - True when it appeared in time
*********************************************************************/
async function waitForFile (file, seconds) {

  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      return true;
    }
    await new Promise(function (done) {
      setTimeout(done, 1000);
    });
  }

  return false;

}


const missing = [];

for (const theme of THEMES) {

  // Walk every family and wait for the report
  const report = join(OUT, PLATFORM + '-' + theme + '.json');
  const reportUrl = 'http://' + HOST + ':' + PORT + '/report';
  process.stdout.write('native-walk: ' + PLATFORM + ' ' + theme + ' -> ' + report + '\n');
  openLink('nimbus://walk?theme=' + theme + '&report=' + encodeURIComponent(reportUrl));
  if (!await waitForFile(report, TIMEOUT_S)) {
    missing.push(report);
    screenshot(join(OUT, PLATFORM + '-' + theme + '-TIMEOUT.png'));
    continue;
  }

  // One screenshot per family
  for (const family of FAMILIES) {
    openLink('nimbus://walk/' + family + '?theme=' + theme);
    await new Promise(function (done) {
      setTimeout(done, 5000);
    });
    screenshot(join(OUT, PLATFORM + '-' + theme + '-' + family + '.png'));
  }

}

if (missing.length > 0) {
  process.stderr.write('native-walk: no report within ' + TIMEOUT_S + 's for: ' + missing.join(', ') + '\n');
  process.exit(1);
}
process.stdout.write('native-walk: ' + THEMES.length + ' reports, ' + (THEMES.length * FAMILIES.length) + ' family screenshots\n');
