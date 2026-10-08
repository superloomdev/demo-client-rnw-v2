// Info: Local CI parity gate. The workflow declares its enforcement gates as
// inline `git grep` steps, which means they are runnable only by pushing. This
// script extracts those steps straight out of ci.yml and runs them locally.
//
// Extraction rather than duplication is deliberate: a hand-mirrored copy of
// the greps would drift from the workflow the first time a gate changed, and a
// drifted mirror is worse than no mirror because it reports false confidence.
// The workflow stays the single source of truth for what a gate asserts.
//
// Usage:
//   node scripts/verify.js           gates + the library ref check + clean installs (root, src/_test,
//                                    hosts/web, hosts/expo) + lint + unit tests +
//                                    web build + Expo web export + e2e, then the
//                                    parity assertion and the stamp
//   node scripts/verify.js --gates   enforcement gates only
//   node scripts/verify.js --fast    skips e2e (inner loop); never
//                                    writes .verify-stamp, so a push to main
//                                    still requires one full run

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GATES_ONLY = process.argv.includes('--gates');
const FAST = process.argv.includes('--fast');


/********************************************************************
Extract every enforcement gate step from the census, not by name pattern.

The census (`scripts/ci-census.js --json`) enumerates every workflow step
structurally and resolves each one against `.ci-step-map.tsv`. Steps whose
`local_gate` includes `gates` are the enforcement gates this script replays.

@return {Array} - List of { name, script, workdir } in workflow order
*********************************************************************/
function getGates () {

  const json = execSync('node scripts/ci-census.js --json', {
    cwd: REPO_ROOT, encoding: 'utf8'
  });
  const steps = JSON.parse(json);
  const gates = [];

  for (const step of steps) {
    const gateList = (step.local_gate || '').split(',').map(function (g) {
      return g.trim();
    }).filter(Boolean);
    if (!gateList.includes('gates')) {
      continue;
    }
    gates.push({
      name: step.name,
      job: step.job,
      script: step.run || '',
      workdir: step.working_directory || ''
    });
  }

  return gates;

}


/********************************************************************
The directories a CI job installs: the working directory of each of its
steps whose kind the census classifies as `install`.

@param {String} job - Job key in ci.yml

@return {Array} - Repo-relative directories ('' for the root)
*********************************************************************/
function getJobInstallDirs (job) {

  const steps = JSON.parse(execSync('node scripts/ci-census.js --json', { cwd: REPO_ROOT, encoding: 'utf8' }));

  return steps.filter(function (step) {
    return step.job === job && step.kind === 'install';
  }).map(function (step) {
    return (step.working_directory || '').replace(/\/$/, '');
  });

}


/********************************************************************
Every node_modules directory in the working tree, outside other
node_modules and .git, as repo-relative parent directories.

@return {Array} - Parent directories ('' for the root)
*********************************************************************/
function getInstalledDirs () {

  const out = [];
  const walk = function (relative, depth) {
    const absolute = path.join(REPO_ROOT, relative);
    for (const name of readdirSync(absolute)) {
      if (name === '.git' || name.endsWith('.verify-aside')) {
        continue;
      }
      const child = path.join(absolute, name);
      if (!statSync(child).isDirectory()) {
        continue;
      }
      if (name === 'node_modules') {
        out.push(relative);
        continue;
      }
      if (depth < 3) {
        walk(path.join(relative, name), depth + 1);
      }
    }
  };
  walk('', 0);

  return out;

}


/********************************************************************
Run a job's replayed steps with the job's filesystem: every node_modules
the job does not install is set aside for the duration and restored
afterwards, so a step that reads packages its job never installs fails
here exactly as it fails on CI (pitfalls: an enforcement job read
packages it never installed).

@param {String}   job - Job key
@param {Function} fn  - The replay

@return {undefined}
*********************************************************************/
function withJobFilesystem (job, fn) {

  // Set aside what the job does not install
  const keep = getJobInstallDirs(job);
  const aside = getInstalledDirs().filter(function (dir) {
    return !keep.includes(dir);
  });
  for (const dir of aside) {
    renameSync(path.join(REPO_ROOT, dir, 'node_modules'), path.join(REPO_ROOT, dir, 'node_modules.verify-aside'));
  }

  // Replay the job's install steps the working tree has not run yet
  for (const dir of keep) {
    if (!existsSync(path.join(REPO_ROOT, dir, 'node_modules'))) {
      install('npm install', path.join(REPO_ROOT, dir));
    }
  }

  // Replay, then restore whatever happens
  try {
    fn();
  } finally {
    for (const dir of aside) {
      renameSync(path.join(REPO_ROOT, dir, 'node_modules.verify-aside'), path.join(REPO_ROOT, dir, 'node_modules'));
    }
  }

}


// Elapsed seconds per named check, printed in the summary so a slow phase
// can be measured rather than inferred from the wall-clock total.
const phaseSeconds = [];


/********************************************************************
Run one named check and record the outcome without stopping the run.

@param {String}   name - Human-readable gate name
@param {Function} fn   - Thunk that throws on failure

@return {Boolean} - True when the check passed
*********************************************************************/
function runCheck (name, fn) {

  process.stdout.write('\n\x1b[1m=== ' + name + ' ===\x1b[0m\n');
  const started = Date.now();

  try {
    fn();
    phaseSeconds.push([name, (Date.now() - started) / 1000]);
    process.stdout.write('\x1b[32mPASS\x1b[0m ' + name + '\n');
    // Report success to the caller
    return true;
  } catch {
    phaseSeconds.push([name, (Date.now() - started) / 1000]);
    process.stdout.write('\x1b[31mFAIL\x1b[0m ' + name + '\n');
    // Report failure to the caller
    return false;
  }

}


// Run a shell command from the repo root, surfacing its output on failure
function sh (cmd, cwd) {
  execSync(cmd, {
    cwd: cwd || REPO_ROOT,
    stdio: 'inherit'
  });
}


// Registry and network failures that say nothing about the tree under test.
// An install that fails this way is retried exactly once, and both attempts
// are printed so the retry is visible in the log.
const TRANSIENT_INSTALL = /E404|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ERR_SOCKET_TIMEOUT|FETCH_ERROR|ECONNREFUSED/;


/********************************************************************
Run an install command, retrying once on a transient network failure.

@param {String} cmd - Shell command
@param {String} cwd - Working directory

@return {undefined}
*********************************************************************/
function install (cmd, cwd) {

  try {
    const out = execSync(cmd, { cwd: cwd, stdio: 'pipe', encoding: 'utf8' });
    process.stdout.write(out);
  } catch (error) {
    const output = String(error.stdout || '') + String(error.stderr || '');
    process.stdout.write(output);
    if (!TRANSIENT_INSTALL.test(output)) {
      throw error;
    }
    process.stdout.write('\x1b[33minstall retry 1 of 1\x1b[0m after transient registry or network error\n');
    sh(cmd, cwd);
  }

}


// ------------------------------- Run ---------------------------------- //

// Parity check: every CI step must have a local mapping or a signed
// unreplicable row. Fail before running any gate if a step is unmapped.
if (!GATES_ONLY) {
  execSync('node scripts/ci-census.js --check-map', {
    cwd: REPO_ROOT, stdio: 'inherit'
  });
}

const gates = getGates();

if (gates.length < 1) {
  process.stdout.write('\x1b[31mFAIL\x1b[0m no gates extracted from census; the step map has no gates row\n');
  process.exit(1);
}

process.stdout.write('extracted ' + gates.length + ' enforcement gates from census\n');

// Preflight: reject non-portable ERE constructs in -E patterns. POSIX ERE
// does not define \b, \d, \s, \w, or (?...). A gate that uses them passes on
// GNU grep (which supports them as extensions) but fails on strict POSIX ERE
// implementations such as macOS grep. This check is gate-count-neutral: it
// never adds or removes a gate, only refuses to run a non-portable one.
const NON_PORTABLE = ['\\b', '\\d', '\\s', '\\w', '(?'];
for (const gate of gates) {
  const lines = gate.script.split('\n');
  for (const line of lines) {
    if (!line.includes('grep')) {
      continue;
    }
    for (const construct of NON_PORTABLE) {
      if (line.includes(construct)) {
        process.stdout.write('FAIL ' + gate.name + ': non-portable construct in an -E pattern\n');
        process.exit(1);
      }
    }
  }
}

// Every gate is a `git grep`, which searches tracked content only. An untracked
// file is invisible to all of them, so a clean local run says nothing about a
// file that has not been staged yet, while CI sees it the moment it is pushed.
const untracked = execSync('git ls-files --others --exclude-standard', {
  cwd: REPO_ROOT, encoding: 'utf8'
}).trim();

if (untracked) {
  process.stdout.write(
    '\n\x1b[31mFAIL\x1b[0m untracked files are invisible to git grep gates.\n' +
    'Use git add -N on each intended file before trusting verification:\n'
  );
  for (const file of untracked.split('\n')) {
    process.stdout.write('  ' + file + '\n');
  }
  process.exit(1);
}

const failed = [];
let passed = 0;
const executed = [];

// Replay the gates job by job, each with that job's filesystem
const gateJobs = gates.map(function (gate) {
  return gate.job;
}).filter(function (job, index, all) {
  return all.indexOf(job) === index;
});
for (const job of gateJobs) {
  withJobFilesystem(job, function () {
    for (const gate of gates.filter(function (entry) {
      return entry.job === job;
    })) {
      const ok = runCheck(gate.name, function () {
        sh(gate.script, gate.workdir ? path.join(REPO_ROOT, gate.workdir) : REPO_ROOT);
      });
      if (ok) {
        passed++;
      } else {
        failed.push(gate.name);
      }
    }
  });
}
executed.push('gates');

if (!GATES_ONLY) {

  // Every install root this repository has; each is installed clean
  const INSTALL_ROOTS = ['.', 'src/_test', 'hosts/web', 'hosts/expo'];

  // Run one phase and record it as executed under its local gate name
  const phase = function (name, fn) {
    if (runCheck(name, fn)) {
      passed++;
    } else {
      failed.push(name);
    }
    executed.push(name);
  };

  // CI checks out the library at the ref `library.ref` names; the sibling
  // checkout must be that ref as pushed, with a clean tree, or a local pass
  // describes a different library commit than CI tests (pitfalls: local
  // verify and CI tested different library commits)
  phase('library ref', function () {
    const ref = readFileSync(path.join(REPO_ROOT, 'library.ref'), 'utf8').trim();
    const library = path.resolve(REPO_ROOT, '..', 'codebase-rnw-components-v2');
    const git = function (args) {
      return execSync('git ' + args, { cwd: library, encoding: 'utf8' }).trim();
    };

    // Resolve the ref as the remote has it: a branch by its pushed head
    git('fetch --quiet origin');
    const remote = 'refs/remotes/origin/' + ref;
    const target = git('for-each-ref --format="%(refname)" ' + remote) === remote ? remote : ref;
    const want = git('rev-parse --verify "' + target + '^{commit}"');
    const head = git('rev-parse HEAD');
    const dirty = git('status --porcelain');
    process.stdout.write('library.ref ' + ref + ' = ' + want + '; sibling HEAD ' + head + '\n');

    // Refuse a sibling that is elsewhere or carries uncommitted changes
    if (head !== want || dirty !== '') {
      process.stdout.write('FAIL: check out ' + ref + ' as pushed, with a clean tree, in ' + library + '\n');
      throw new Error('library ref mismatch');
    }
  });

  phase('clean install', function () {
    for (const root of INSTALL_ROOTS) {
      const dir = path.join(REPO_ROOT, root);
      sh('rm -rf node_modules package-lock.json', dir);
      install('npm install', dir);
    }
  });

  phase('eslint', function () {
    sh('npx eslint .');
  });

  phase('unit tests (src/_test)', function () {
    sh('npm test', path.join(REPO_ROOT, 'src', '_test'));
  });

  phase('web build', function () {
    sh('npx vite build', path.join(REPO_ROOT, 'hosts', 'web'));
  });

  phase('expo web export', function () {
    sh('npx expo export --platform web --output-dir dist', path.join(REPO_ROOT, 'hosts', 'expo'));
  });

  if (!FAST) {
    phase('e2e', function () {
      sh('npx playwright install --with-deps chromium');
      sh('npx playwright test');
    });
  }

}


// ----------------------------- Summary -------------------------------- //

process.stdout.write('\n\x1b[1m=== Summary ===\x1b[0m\n');
for (const [name, seconds] of phaseSeconds) {
  process.stdout.write('phase ' + seconds.toFixed(1).padStart(8) + 's  ' + name + '\n');
}
process.stdout.write('passed: ' + passed + '\n');

if (failed.length >= 1) {
  process.stdout.write('\x1b[31mfailed:\x1b[0m\n');
  for (const name of failed) {
    process.stdout.write('  - ' + name + '\n');
  }
  process.exit(1);
}

// Parity assertion: every replayed gate in the step map must have been
// executed in this run. In gates-only or fast mode, the full gate set is
// not executed, so the assertion is skipped and no stamp is written.
if (!GATES_ONLY && !FAST) {
  execSync('node scripts/ci-census.js --assert-executed "' + executed.join(',') + '"', {
    cwd: REPO_ROOT, stdio: 'inherit'
  });
  // Write the content hash stamp so the pre-push hook can verify it.
  const hash = execSync('bash scripts/content-hash.sh', {
    cwd: REPO_ROOT, encoding: 'utf8'
  }).trim();
  writeFileSync(path.join(REPO_ROOT, '.verify-stamp'), hash + '\n');
  process.stdout.write('verify stamp written\n');
} else if (FAST) {
  process.stdout.write('ci parity: fast mode - executed-set assertion skipped; run npm run verify before pushing to main\n');
}

process.stdout.write('\x1b[32mall gates passed\x1b[0m\n');
