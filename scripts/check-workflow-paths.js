// Info: Every `node <file>.js` a workflow step runs must exist relative to
// that step's working directory. A step that sets `working-directory` to a
// host folder and names a repo-root script fails only on the runner, after
// the build it depended on; this check fails it here, in seconds.
//
// Jobs that check out this repository into a subfolder (`path:`) prefix
// their working directories with that folder; the prefix is stripped so the
// path resolves against this checkout.
//
// Usage: node scripts/check-workflow-paths.js   (checks .github/workflows/*.yml)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = join(REPO_ROOT, '.github', 'workflows');
const CHECKOUT = 'codebase-demo-client-rnw-v2';


/********************************************************************
Map a workflow working directory onto this checkout.

@param {String} workdir - As written in the workflow ('' when unset)

@return {String|null} - Repo-relative directory, or null when it points
                        into another checkout (not this repository)
*********************************************************************/
function toRepoDir (workdir) {

  if (workdir === '' || workdir === '.') {
    return '';
  }
  if (workdir === CHECKOUT) {
    return '';
  }
  if (workdir.indexOf(CHECKOUT + '/') === 0) {
    return workdir.slice(CHECKOUT.length + 1);
  }
  if (workdir.indexOf('codebase-') === 0) {
    return null;
  }

  return workdir;

}


const findings = [];
let checked = 0;

for (const file of readdirSync(WORKFLOWS).filter(function (name) {
  return name.endsWith('.yml');
}).sort()) {

  // Walk the file step by step: a step starts at a `- ` list item inside a
  // job's steps; its working directory is any `working-directory:` in it
  const lines = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n');
  const steps = [];
  let current = null;
  lines.forEach(function (line, index) {
    if (/^\s{6}- /.test(line)) {
      current = { start: index + 1, workdir: '', commands: [] };
      steps.push(current);
    } else if (/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line)) {
      current = null;
    }
    if (current === null) {
      return;
    }
    const workdir = line.match(/working-directory:\s*(\S+)/);
    if (workdir) {
      current.workdir = workdir[1];
    }
    const pattern = /\bnode\s+([^\s|;&)]+\.js)\b/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      current.commands.push({ script: match[1], line: index + 1 });
    }
  });

  // Resolve every script against its step's directory
  for (const step of steps) {
    const dir = toRepoDir(step.workdir);
    if (dir === null) {
      continue;
    }
    for (const command of step.commands) {
      checked++;
      const target = resolve(REPO_ROOT, dir, command.script);
      if (!existsSync(target)) {
        findings.push(file + ':' + command.line + ' node ' + command.script + ' from "' + (step.workdir || '(root)') + '" -> ' + relative(REPO_ROOT, target) + ' does not exist');
      }
    }
  }

}

for (const finding of findings) {
  process.stdout.write('FAIL ' + finding + '\n');
}
process.stdout.write('workflow paths: ' + checked + ' node script invocation(s) checked, ' + findings.length + ' missing\n');
process.exit(findings.length === 0 ? 0 : 1);
