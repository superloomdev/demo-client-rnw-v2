// Info: CI workflow step census
//
// The local parity runners extracted workflow steps by matching the step name
// against `G\d+`. Every step named anything else was skipped silently, so the
// runner could report "all gates passed" while whole jobs had never run. This
// script enumerates the workflow structurally - every job, every step - so the
// runner can be driven from a complete list instead of a name pattern, and so
// a step with no local counterpart is a visible gap rather than an absence.
//
// Deliberately hand-parses the YAML: the repo has no YAML dependency and a
// census script is not a reason to add one. The parse relies only on the
// indentation contract GitHub Actions requires (job keys, a steps list, step
// properties one level in).
//
// Usage: node scripts/ci-census.js [output.tsv]
//   --json              print a JSON array of every step with its resolution
//   --check-map         print a parity summary and exit 1 if any step is unmapped
//   --assert-executed GATES   check that every replayed step's gates were executed
// Writes TSV to the path when given, otherwise to stdout. A summary always
// goes to stderr so it stays out of the TSV. Flags override the TSV default.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');


/********************************************************************
Count the leading spaces on a line.

@param {String} line - One raw line

@return {Number} - Leading space count
*********************************************************************/
function getIndent (line) {

  const match = line.match(/^ */);
  return match[0].length;

}


/********************************************************************
Apply one `key: value` property to the step being collected. Unknown
keys are ignored, which is how `with:`, `env:` and `if:` fall away.

@param {Object} step - Step accumulator
@param {String} text - Trimmed property text
*********************************************************************/
function applyProperty (step, text) {

  const match = text.match(/^(name|uses|run|working-directory):\s*(.*)$/);
  if (!match) {
    return;
  }

  const key = match[1];
  const value = match[2];

  if (key === 'name') {
    step.name = value;
    return;
  }

  if (key === 'uses') {
    step.uses = value;
    return;
  }

  if (key === 'working-directory') {
    step.workdir = value;
    return;
  }

  // A block scalar (`run: |`) carries no value on its own line; the body is
  // collected separately so the first real command can be reported
  if (key === 'run' && !/^[|>]/.test(value)) {
    step.run = value;
  }

}


/********************************************************************
Classify a step by what it actually does, not by its name.

@param {Object} step - Collected step

@return {String} - action | install | inline-script | command | other
*********************************************************************/
function getKind (step) {

  if (step.uses) {
    return 'action';
  }

  if (!step.run) {
    return 'other';
  }

  if (/\bnpm (ci|install)\b/.test(step.run)) {
    return 'install';
  }

  if (step.multiline) {
    return 'inline-script';
  }

  return 'command';

}


/********************************************************************
Walk the workflow and collect every step of every job.

@return {Array} - Step rows in workflow order
*********************************************************************/
function getCensus () {

  const lines = readFileSync(WORKFLOW, 'utf8').split('\n');
  const rows = [];

  let inJobs = false;
  let inSteps = false;
  let job = null;
  let jobWorkdir = '';
  let step = null;
  let stepIndent = -1;
  let collectingRun = false;
  let runIndent = -1;

  // Close the step under construction and record it
  function flush () {
    if (step && job) {
      if (step.runLines.length > 0) {
        step.run = step.runLines.join('\n');
      }
      step.job = job;
      step.workdir = step.workdir || jobWorkdir;
      step.kind = getKind(step);
      rows.push(step);
    }
    step = null;
    collectingRun = false;
  }

  for (const raw of lines) {

    const line = raw.replace(/\s+$/, '');

    // A blank line inside a block scalar belongs to the block
    if (line === '') {
      continue;
    }

    const indent = getIndent(line);
    const body = line.trim();

    // Everything before the jobs map is workflow-level config
    if (!inJobs) {
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true;
      }
      continue;
    }

    // Inside a block scalar: anything indented at or past the body column
    if (collectingRun) {
      if (indent >= runIndent) {
        step.runLines.push(line.slice(runIndent));
        continue;
      }
      collectingRun = false;
    }

    // A job key sits one level inside the jobs map
    if (indent === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(body)) {
      flush();
      job = body.replace(/:$/, '');
      jobWorkdir = '';
      inSteps = false;
      continue;
    }

    if (indent === 4 && /^steps:\s*$/.test(body)) {
      flush();
      inSteps = true;
      stepIndent = -1;
      continue;
    }

    // A job-level default working directory applies to every step in the job
    if (!inSteps && /^working-directory:/.test(body)) {
      jobWorkdir = body.replace(/^working-directory:\s*/, '');
      continue;
    }

    if (!inSteps) {
      continue;
    }

    // A new step begins at the list dash
    if (/^- /.test(body)) {
      flush();
      stepIndent = indent;
      step = { name: '', uses: '', run: '', runLines: [], multiline: false, workdir: '' };
      const rest = body.replace(/^- /, '');
      applyProperty(step, rest);
      if (/^run:\s*[|>]/.test(rest)) {
        step.multiline = true;
        collectingRun = true;
        runIndent = indent + 4;
      }
      continue;
    }

    // Step properties sit exactly one level inside the dash
    if (step && indent === stepIndent + 2) {
      applyProperty(step, body);
      if (/^run:\s*[|>]/.test(body)) {
        step.multiline = true;
        collectingRun = true;
        runIndent = indent + 2;
      }
    }

  }

  flush();
  return rows;

}


// --- TSV map reader --------------------------------------------------------

function loadTsv (filePath) {

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headerCols = lines[0].split('\t');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }
    const cols = line.split('\t');
    const row = {};
    for (let c = 0; c < headerCols.length && c < cols.length; c++) {
      row[headerCols[c]] = cols[c];
    }
    rows.push(row);
  }

  return rows;

}


const STEP_MAP = loadTsv(path.join(REPO_ROOT, '.ci-step-map.tsv'));
const UNREPLICABLE = loadTsv(path.join(REPO_ROOT, '.ci-unreplicable.tsv'));

const D7_PREFIXES = [
  'hosted-runner-setup',
  'artifact-upload',
  'registry-publish',
  'native-toolchain: owner decision'
];


/********************************************************************
Resolve one census step against the step map and the unreplicable set.

Resolution order: step map top-to-bottom (first match = replayed), then
unreplicable top-to-bottom (first match = unreplicable, reason must begin
with a D7 prefix), then unmapped.

@param {Object} step - Census step row

@return {Object} - { class, local_gate, reason }
*********************************************************************/
function resolveStep (step) {

  const name = step.name || '';
  const job = step.job || '';
  const kind = step.kind || '';

  // 1. Step map: first match wins, class = replayed
  for (const row of STEP_MAP) {
    const field = row.match_field;
    let value = '';
    if (field === 'name') {
      value = name;
    } else if (field === 'job') {
      value = job;
    } else if (field === 'kind') {
      value = kind;
    }
    if (value && new RegExp('^(?:' + row.pattern + ')$').test(value)) {
      return { class: 'replayed', local_gate: row.local_gate || '', reason: '' };
    }
  }

  // 2. Unreplicable: first match wins, class = unreplicable
  for (const row of UNREPLICABLE) {
    const field = row.match_field;
    let value = '';
    if (field === 'name') {
      value = name;
    } else if (field === 'job') {
      value = job;
    } else if (field === 'kind') {
      value = kind;
    }
    if (value && new RegExp('^(?:' + row.pattern + ')$').test(value)) {
      const reason = row.reason || '';
      const hasD7Prefix = D7_PREFIXES.some(function (p) {
        return reason.startsWith(p);
      });
      if (!hasD7Prefix) {
        return { class: 'unmapped', local_gate: '', reason: 'unreplicable reason not in the closed set: ' + reason };
      }
      return { class: 'unreplicable', local_gate: '', reason: reason };
    }
  }

  // 3. Unmapped
  return { class: 'unmapped', local_gate: '', reason: 'no local counterpart and no signed unreplicable row' };

}


// --- Argument parsing ------------------------------------------------------

const JSON_MODE = process.argv.includes('--json');
const CHECK_MAP = process.argv.includes('--check-map');
const ASSERT_IDX = process.argv.indexOf('--assert-executed');
const ASSERT_MODE = ASSERT_IDX !== -1;
const EXECUTED_GATES = ASSERT_MODE ? process.argv[ASSERT_IDX + 1] || '' : '';

// The original positional output path is still supported when no flag is given
const OUT_PATH = (!JSON_MODE && !CHECK_MAP && !ASSERT_MODE)
  ? (process.argv[2] || null)
  : null;


// --- Emit ------------------------------------------------------------------

const rows = getCensus();

// Resolve every step
for (const row of rows) {
  const r = resolveStep(row);
  row.class = r.class;
  row.local_gate = r.local_gate;
  row.reason = r.reason;
}

if (JSON_MODE) {

  const out = rows.map(function (row, i) {
    return {
      job: row.job,
      index: i + 1,
      name: row.name || '(unnamed)',
      kind: row.kind,
      working_directory: row.workdir || '',
      run: row.run || row.uses || '',
      class: row.class,
      local_gate: row.local_gate,
      reason: row.reason
    };
  });
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');

} else if (CHECK_MAP) {

  const total = rows.length;
  let mapped = 0;
  let unreplicable = 0;
  let unmapped = 0;
  const unmappedLines = [];

  for (const row of rows) {
    if (row.class === 'replayed') {
      mapped++;
    } else if (row.class === 'unreplicable') {
      unreplicable++;
    } else {
      unmapped++;
      unmappedLines.push('UNMAPPED ' + row.job + ' :: ' + (row.name || '(unnamed)') + ' :: ' + row.reason);
    }
  }

  process.stdout.write('ci parity: steps ' + total + '  mapped ' + mapped + '  unreplicable ' + unreplicable + '  unmapped ' + unmapped + '\n');
  for (const line of unmappedLines) {
    process.stdout.write(line + '\n');
  }
  process.exit(unmapped > 0 ? 1 : 0);

} else if (ASSERT_MODE) {

  const executed = EXECUTED_GATES.split(',').filter(function (g) {
    return g.trim() !== '';
  });
  const executedSet = new Set(executed);

  // Collect distinct local_gate names across all replayed steps
  const replayedGates = new Set();
  const misses = [];

  for (const row of rows) {
    if (row.class !== 'replayed') {
      continue;
    }
    const gates = row.local_gate.split(',').filter(function (g) {
      return g.trim() !== '';
    });
    for (const g of gates) {
      replayedGates.add(g);
      if (!executedSet.has(g)) {
        misses.push('NOT EXECUTED ' + row.job + ' :: ' + (row.name || '(unnamed)') + ' -> ' + g);
      }
    }
  }

  let executedCount = 0;
  for (const g of replayedGates) {
    if (executedSet.has(g)) {
      executedCount++;
    }
  }

  process.stdout.write('ci parity: executed ' + executedCount + ' of ' + replayedGates.size + ' replayed gates\n');
  for (const line of misses) {
    process.stdout.write(line + '\n');
  }
  process.exit(misses.length > 0 ? 1 : 0);

} else {

  // Default: TSV output (original behavior)
  const header = ['job', 'index', 'name', 'kind', 'working_directory', 'named', 'first_command'].join('\t');
  const body = rows.map(function (row, i) {
    const command = (row.uses || row.run || '').slice(0, 80).replace(/\t/g, ' ');
    return [
      row.job,
      String(i + 1),
      row.name || '(unnamed)',
      row.kind,
      row.workdir || '(repo root)',
      row.name ? 'yes' : 'no',
      command
    ].join('\t');
  });

  const tsv = [header].concat(body).join('\n') + '\n';

  if (OUT_PATH) {
    writeFileSync(OUT_PATH, tsv);
  } else {
    process.stdout.write(tsv);
  }

  // The named-step count is the figure that must equal
  // `grep -cE "^\s+- name:" .github/workflows/ci.yml`
  const named = rows.filter(function (row) {
    return Boolean(row.name);
  }).length;

  const jobs = {};
  for (const row of rows) {
    jobs[row.job] = (jobs[row.job] || 0) + 1;
  }

  const kinds = {};
  for (const row of rows) {
    kinds[row.kind] = (kinds[row.kind] || 0) + 1;
  }

  process.stderr.write('jobs: ' + Object.keys(jobs).length + '\n');
  process.stderr.write('steps total: ' + rows.length + '\n');
  process.stderr.write('steps named: ' + named + '\n');
  process.stderr.write('by kind: ' + JSON.stringify(kinds) + '\n');
  process.stderr.write('per job: ' + JSON.stringify(jobs) + '\n');

}
