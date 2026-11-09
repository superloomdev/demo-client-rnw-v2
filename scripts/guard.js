// Info: Process containment for test, bundle, Playwright and fire children
// (D43). A child that runs away on memory - five node processes were killed
// by macOS Jetsam at ~375 GB resident in about 90 s - cannot be stopped by
// a procedural rule, so the run itself gets a wrapper that watches the whole
// process tree once a second and kills it first.
//
// Usage: node scripts/guard.js [--seconds N] [--proc-mb N] [--tree-mb N] [--sample-ms N] -- <command> [args...]
// Defaults: seconds 1800 (GUARD_SECONDS), proc-mb 6144 (GUARD_PROC_MB),
// tree-mb 12288 (GUARD_TREE_MB). Kills exit 137 (memory) or 124 (time); the
// child's own exit code otherwise (1 on a signal). The child's stdio is
// inherited, never captured: the guard holds no buffers. When `ps` is
// unavailable the guard logs once and keeps running the child - containment
// degrades, it never blocks a run.
//
// Every kill appends one line to _test/test-results/guard.log, resolved from
// this file's repo root rather than the caller's cwd.

import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOG_FILE = join(REPO_ROOT, '_test', 'test-results', 'guard.log');


/********************************************************************
Parse one numeric option value; reject anything not a positive finite
number so a malformed invocation fails fast instead of silently running
with defaults.

@param {String} name  - Option name for the error message
@param {String} value - Raw value

@return {Number} - The parsed number
*********************************************************************/
function numberOption (name, value) {

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write('guard: ' + name + ' expects a positive number, got "' + value + '"\n');
    process.exit(2);
  }
  return parsed;

}


const args = process.argv.slice(2);
const separator = args.indexOf('--');
if (separator === -1 || separator === args.length - 1) {
  process.stderr.write('usage: node scripts/guard.js [--seconds N] [--proc-mb N] [--tree-mb N] [--sample-ms N] -- <command> [args...]\n');
  process.exit(2);
}

let seconds = numberOption('--seconds', process.env.GUARD_SECONDS || 1800);
let procMb = numberOption('--proc-mb', process.env.GUARD_PROC_MB || 6144);
let treeMb = numberOption('--tree-mb', process.env.GUARD_TREE_MB || 12288);
let sampleMs = numberOption('--sample-ms', process.env.GUARD_SAMPLE_MS || 1000);
const options = args.slice(0, separator);
for (let index = 0; index < options.length; index += 1) {
  const option = options[index];
  const pair = option.split('=');
  const name = pair[0];
  const value = pair.length > 1 ? pair.slice(1).join('=') : options[index + 1];
  if (pair.length === 1) {
    index += 1;
  }
  if (name === '--seconds') {
    seconds = numberOption(name, value);
  } else if (name === '--proc-mb') {
    procMb = numberOption(name, value);
  } else if (name === '--tree-mb') {
    treeMb = numberOption(name, value);
  } else if (name === '--sample-ms') {
    sampleMs = numberOption(name, value);
  } else {
    process.stderr.write('guard: unknown option ' + option + '\n');
    process.exit(2);
  }
}

const command = args[separator + 1];
const commandArgs = args.slice(separator + 2);

// The child gets a 4 GB old-space ceiling unless its environment already
// names one (verify's fire step pins 3072 and must keep it)
const env = { ...process.env };
if (!/max-old-space-size/.test(env.NODE_OPTIONS || '')) {
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --max-old-space-size=4096').trim();
}

const child = spawn(command, commandArgs, { stdio: 'inherit', env: env });
const started = Date.now();
let settled = false;
let psWarned = false;
let lastOrder = [child.pid];


/********************************************************************
Snapshot the process table and reduce it to the child's tree.

@param {Number} rootPid - The child's pid

@return {Object} - { order: pids deepest-first with the child last,
  maxPid/maxRssMb: the largest resident process, treeMb: total }
*********************************************************************/
function sampleTree (rootPid) {

  const table = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' });
  const children = new Map();
  const rssKb = new Map();
  for (const line of table.split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 3) {
      continue;
    }
    const pid = Number(fields[0]);
    const ppid = Number(fields[1]);
    const rss = Number(fields[2]);
    if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(rss)) {
      continue;
    }
    rssKb.set(pid, rss);
    if (!children.has(ppid)) {
      children.set(ppid, []);
    }
    children.get(ppid).push(pid);
  }

  // Post-order walk: descendants deepest first, the root last
  const order = [];
  const walk = function (pid) {
    for (const descendant of children.get(pid) || []) {
      walk(descendant);
    }
    order.push(pid);
  };
  walk(rootPid);

  let maxPid = rootPid;
  let maxRssMb = 0;
  let treeRssKb = 0;
  for (const pid of order) {
    const rss = rssKb.get(pid) || 0;
    treeRssKb += rss;
    if (rss > maxRssMb * 1024) {
      maxRssMb = rss / 1024;
      maxPid = pid;
    }
  }

  return { order: order, maxPid: maxPid, maxRssMb: maxRssMb, treeMb: treeRssKb / 1024 };

}


/********************************************************************
SIGKILL every pid in the order `sampleTree` returned (deepest first, the
child last). Pids that already exited are ignored.
*********************************************************************/
function killTree (order) {

  for (const pid of order) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone
    }
  }

}


/********************************************************************
Send a signal to the last known tree; fall back to the child alone when
`ps` is unavailable.

@param {String} signal - Signal name
*********************************************************************/
function signalTree (signal) {

  let order = lastOrder;
  try {
    order = sampleTree(child.pid).order;
  } catch {
    // Keep the previous snapshot
  }
  for (const pid of order) {
    try {
      process.kill(pid, signal);
    } catch {
      // Already gone
    }
  }

}


/********************************************************************
Report a kill and finish: one GUARD: line to stderr and the log file,
then the documented exit code.

@param {String} reason - 'memory' or 'time'
@param {Object} sample - Last sampleTree result
*********************************************************************/
function terminate (reason, sample) {

  settled = true;
  clearInterval(timer);
  killTree(sample.order);
  const line = 'GUARD: killed ' + reason +
    ' pid=' + sample.maxPid +
    ' rss=' + Math.round(sample.maxRssMb) +
    ' tree=' + Math.round(sample.treeMb) +
    ' after ' + Math.round((Date.now() - started) / 1000) + 's: ' +
    [command].concat(commandArgs).join(' ');
  writeSync(2, line + '\n');
  try {
    mkdirSync(join(REPO_ROOT, '_test', 'test-results'), { recursive: true });
    appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // The log is best-effort; the kill already happened
  }
  process.exit(reason === 'memory' ? 137 : 124);

}


const timer = setInterval(function () {

  if (settled) {
    return;
  }
  let sample;
  try {
    sample = sampleTree(child.pid);
  } catch (error) {
    if (!psWarned) {
      psWarned = true;
      process.stderr.write('GUARD: ps failed (' + error.message + '); memory containment off, the wall clock still applies\n');
    }
    return;
  }
  lastOrder = sample.order;

  // The per-process ceiling names the fattest descendant; the tree ceiling
  // catches many small processes that are one runaway in aggregate
  const memoryExceeded = sample.maxRssMb > procMb || sample.treeMb > treeMb;
  if (memoryExceeded) {
    terminate('memory', sample);
    return;
  }
  if (Date.now() - started > seconds * 1000) {
    terminate('time', sample);
  }

}, sampleMs);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, function () {
    signalTree(signal);
    process.exit(1);
  });
}

child.on('error', function (error) {
  settled = true;
  clearInterval(timer);
  process.stderr.write('guard: cannot spawn ' + command + ': ' + error.message + '\n');
  process.exit(127);
});

child.on('exit', function (code, signal) {
  if (settled) {
    return;
  }
  settled = true;
  clearInterval(timer);
  process.exit(signal ? 1 : (code === null ? 1 : code));
});
