// Info: Drives the walker on a booted simulator or emulator for the native
// gate. For each template it starts a walk, waits for the report file, then
// walks once per family and takes a screenshot. The walk server must already
// be running and writing to `--out`. Two ways to steer the app:
//
//   --mode link (default)  deep links: nimbus://walk?theme=..&report=.. from a
//                          stopped app (cold), then nimbus://walk/<Family>
//                          into the running app (warm). Android.
//   --mode command         the app was built with EXPO_PUBLIC_WALK_SERVER and
//                          polls the server's /command; this driver launches
//                          the app once and posts each command. iOS, where a
//                          custom-scheme link opened from outside stops at a
//                          system dialog no simulator command can tap.
//
// Usage: node scripts/native-walk.js --platform ios|android --out <dir>
//          [--mode link|command] [--report-host localhost|10.0.2.2]
//          [--port 8787] [--themes default,carbon,material] [--timeout 180]
//          [--app-id com.anonymous.nimbusrnwdemo]

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { catalog } from '../hosts/expo/node_modules/@superloomdev/rnw-components/catalog.js';
import { isAppFocused } from './device-focus.js';

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
const APP_ID = arg('--app-id', 'com.anonymous.nimbusrnwdemo');
const MODE = arg('--mode', 'link');

if (MODE !== 'link' && MODE !== 'command') {
  process.stderr.write('native-walk: --mode must be link or command\n');
  process.exit(2);
}

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
Stop the app so the next link cold-starts it. Stopping an app that is not
running is not an error.

@return {undefined}
*********************************************************************/
function stopApp () {

  try {
    if (PLATFORM === 'ios') {
      execFileSync('xcrun', ['simctl', 'terminate', 'booted', APP_ID], { stdio: 'ignore' });
    } else {
      execFileSync('adb', ['shell', 'am', 'force-stop', APP_ID], { stdio: 'ignore' });
    }
  } catch {
    // Not running: nothing to stop
  }

}


/********************************************************************
Launch the app plainly (no URL), for command mode.

@return {undefined}
*********************************************************************/
function launchApp () {

  if (PLATFORM === 'ios') {
    execFileSync('xcrun', ['simctl', 'launch', 'booted', APP_ID], { stdio: 'inherit' });
    return;
  }
  execFileSync('adb', ['shell', 'monkey', '-p', APP_ID, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'inherit' });

}


/********************************************************************
Post a walk command to the server (command mode).

@param {String}      theme  - Template name
@param {String|null} family - One family, or null for all

@return {Promise<undefined>}
*********************************************************************/
async function postCommand (theme, family) {

  const response = await fetch('http://localhost:' + PORT + '/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme: theme, family: family })
  });
  if (!response.ok) {
    throw new Error('native-walk: POST /command answered ' + response.status);
  }
  await response.text();

}


/********************************************************************
Start a walk: a deep link in link mode, a server command in command mode.

@param {String}      theme  - Template name
@param {String|null} family - One family, or null for all

@return {Promise<undefined>}
*********************************************************************/
async function startWalk (theme, family) {

  if (MODE === 'command') {
    await postCommand(theme, family);
    return;
  }
  const reportUrl = 'http://' + HOST + ':' + PORT + '/report';
  openLink(family
    ? 'nimbus://walk/' + family + '?theme=' + theme
    : 'nimbus://walk?theme=' + theme + '&report=' + encodeURIComponent(reportUrl));

}


// Android screenshots taken while another window had focus
const obscured = [];


/********************************************************************
Run an adb shell command the device may refuse; a refusal is not an
error, because the focus check after it is what decides.

@param {Array} args - Arguments after `adb shell`

@return {undefined}
*********************************************************************/
function tryShell (args) {

  try {
    execFileSync('adb', ['shell'].concat(args), { stdio: 'ignore' });
  } catch {
    // Refused on this image: the focus check decides
  }

}


/********************************************************************
Screenshot the booted device into a PNG file. On Android the app must
hold focus first: system dialogs are closed and focus is checked up to
three times, and a screenshot of any other window is recorded as
obscured (it is still written, so the evidence shows what covered it).

@param {String} file - Output path

@return {undefined}
*********************************************************************/
function screenshot (file) {

  if (PLATFORM === 'ios') {
    execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', file], { stdio: 'inherit' });
    return;
  }

  // Close whatever system dialog covers the app, then confirm the app has focus
  let focused = false;
  for (let attempt = 0; attempt < 3 && !focused; attempt++) {
    tryShell(['am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS']);
    execFileSync('sleep', ['1']);
    focused = isAppFocused(execFileSync('adb', ['shell', 'dumpsys', 'window'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }), APP_ID);
  }
  if (!focused) {
    obscured.push(file);
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

// An emulator under load reports other apps as not responding; those
// prompts take focus over the app, so they are switched off before walking
if (PLATFORM === 'android') {
  tryShell(['settings', 'put', 'global', 'hide_error_dialogs', '1']);
}

// Command mode: the app runs once and takes every command from the server
if (MODE === 'command') {
  stopApp();
  launchApp();
}

for (const theme of THEMES) {

  // Walk every family and wait for the report
  const report = join(OUT, PLATFORM + '-' + theme + '.json');
  process.stdout.write('native-walk: ' + PLATFORM + ' ' + theme + ' (' + MODE + ') -> ' + report + '\n');
  if (MODE === 'link') {
    stopApp();
  }
  await startWalk(theme, null);
  if (!await waitForFile(report, TIMEOUT_S)) {
    missing.push(report);
    screenshot(join(OUT, PLATFORM + '-' + theme + '-TIMEOUT.png'));
    continue;
  }

  // One screenshot per family
  for (const family of FAMILIES) {
    await startWalk(theme, family);
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
if (obscured.length > 0) {
  process.stderr.write('native-walk: another window had focus for: ' + obscured.join(', ') + '\n');
  process.exit(1);
}
process.stdout.write('native-walk: ' + THEMES.length + ' reports, ' + (THEMES.length * FAMILIES.length) + ' family screenshots\n');
