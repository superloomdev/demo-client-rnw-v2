// Info: A name we declare never starts with an underscore (the component
// library's docs/authoring.md "Names"). This check reads every tracked JavaScript and
// JSON file token by token: an identifier, a property key (bare, quoted or
// bracketed) or a JSON key that starts with an underscore fails, unless it
// is on the allowlist below. A comment, a regular expression and any other
// string are text and are never read as names, so a citation of an upstream
// `_file.scss` and a token name tail joined in place (`base + '_hover'`)
// pass. A tracked file or folder whose own name starts with an underscore
// fails unless it is an allowed path. A self-test proves the reader finds
// a planted name before the clean run is trusted.
//
// Usage: node scripts/names-check.js   (the self-test, then every tracked file)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The exceptions: names the language or the platform owns
export const ALLOWED_NAMES = Object.freeze(['__dirname', '__filename', '__proto__']);

// The allowed paths: the test folder and Expo Router's layout file
export const ALLOWED_PATHS = Object.freeze(['_test', '_layout.js']);

// Lockfiles are generated, not source
const SKIPPED = /(^|\/)package-lock\.json$/;

// A name that starts with an underscore and holds at least one letter or digit
const NAME = /^_[\w$]*[A-Za-z0-9$][\w$]*/;

// The characters after which a slash opens a regular expression
const REGEX_BEFORE = '(,=:[!&|?{};+-*%<>~^\n';

// The keywords after which a slash opens a regular expression
const REGEX_KEYWORDS = Object.freeze(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do']);


/********************************************************************
Find every name that starts with an underscore in one JavaScript source.

@param {String} source - File contents

@return {Array} - [{ line, name }] for every name not on the allowlist
*********************************************************************/
export function findInJavascript (source) {

  // Walk the source once, remembering the last character that is not blank space
  const found = [];
  let at = 0;
  let line = 1;
  let last = '\n';
  let member = false;
  while (at < source.length) {
    const char = source[at];
    const next = source[at + 1];

    // A line comment and a block comment are citations
    if (char === '/' && (next === '/' || next === '*')) {
      const end = next === '/' ? source.indexOf('\n', at) : source.indexOf('*/', at + 2);
      const stop = end === -1 ? source.length : next === '/' ? end : end + 2;
      line += countLines(source, at, stop);
      at = stop;
      continue;
    }

    // A regular expression is text
    if (char === '/' && REGEX_BEFORE.includes(last)) {
      let end = at + 1;
      let inClass = false;
      while (end < source.length && source[end] !== '\n' && (source[end] !== '/' || inClass)) {
        if (source[end] === '\\') {
          end += 1;
        } else if (source[end] === '[') {
          inClass = true;
        } else if (source[end] === ']') {
          inClass = false;
        }
        end += 1;
      }
      at = end + 1;
      last = 'x';
      continue;
    }

    // A string is text, except where it is a property key
    if (char === '\'' || char === '"' || char === '`') {
      let end = at + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === '\\' ? 2 : 1;
      }
      const text = source.slice(at + 1, end);
      const after = source.slice(end + 1).trimStart();
      const isKey = (after.startsWith(':') && (last === '{' || last === ',')) || (last === '[' && member && after.startsWith(']'));
      if (isKey && NAME.test(text)) {
        record(found, line, NAME.exec(text)[0]);
      }
      line += countLines(source, at, end);
      at = end + 1;
      last = 'x';
      continue;
    }

    // An identifier: a name when it starts with an underscore
    if (/[A-Za-z_$]/.test(char) && !(at > 0 && /[\w$]/.test(source[at - 1]))) {
      const word = /^[\w$]+/.exec(source.slice(at, at + 200))[0];
      if (NAME.test(word)) {
        record(found, line, word);
      }
      at += word.length;
      last = REGEX_KEYWORDS.includes(word) ? '(' : 'x';
      continue;
    }

    // Any other character; a bracket after a value opens a member read, not an array
    if (char === '\n') {
      line += 1;
    }
    if (char === '[') {
      member = last === 'x' || last === ')' || last === ']';
    }
    if (!/\s/.test(char)) {
      last = char;
    }
    at += 1;
  }

  return found;

}


/********************************************************************
Find every key that starts with an underscore in one JSON source.

@param {String} source - File contents

@return {Array} - [{ line, name }] for every key not on the allowlist
*********************************************************************/
export function findInJson (source) {

  // Read each line's keys
  const found = [];
  source.split('\n').forEach(function (text, index) {
    for (const match of text.matchAll(/"(_[^"]*)"\s*:/g)) {
      if (NAME.test(match[1])) {
        record(found, index + 1, match[1]);
      }
    }
  });

  return found;

}


/********************************************************************
Check every tracked file of the repository.

@return {Array} - 'path:line name' for every finding
*********************************************************************/
export function checkRepository () {

  // List the tracked files
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\0').filter(function (file) {
    return file !== '' && !SKIPPED.test(file);
  });

  // A path segment, then the file's own names
  const findings = [];
  for (const file of files) {
    for (const part of file.split('/')) {
      if (part.startsWith('_') && !ALLOWED_PATHS.includes(part)) {
        findings.push(file + ' path ' + part);
      }
    }
    const reader = /\.(js|mjs|cjs)$/.test(file) ? findInJavascript : file.endsWith('.json') ? findInJson : null;
    if (reader !== null) {
      for (const hit of reader(readFileSync(join(REPO_ROOT, file), 'utf8'))) {
        findings.push(file + ':' + hit.line + ' ' + hit.name);
      }
    }
  }

  return findings;

}


/********************************************************************
Prove the reader tells names, text and comments apart.

@return {Boolean} - True when every planted name is found and no text is
*********************************************************************/
export function runSelftest () {

  // Plant one of each kind of name among text that must pass
  const source = [
    '// a citation of _page-header.scss and _commented',
    'const PALETTE = { _hover: 1, \'_quoted\': 2, plain: 3 };',
    'const _declared = PALETTE[\'_bracket\'];',
    'function run (_param) { return window.__global + base + \'_tail\' + `_templated`; }',
    'const pattern = /^anatomy\\..*_widget$/;',
    'const list = [\'_alone\'];',
    'const join = ok ? \'_one\' : \'_two\';',
    'call(__dirname); /* block _blocked */'
  ].join('\n');
  const found = findInJavascript(source).map(function (hit) {
    return hit.line + ' ' + hit.name;
  });
  const json = findInJson('{\n  "plain": 1,\n  "_meta": 2\n}').map(function (hit) {
    return hit.line + ' ' + hit.name;
  });

  return JSON.stringify(found) === JSON.stringify(['2 _hover', '2 _quoted', '3 _declared', '3 _bracket', '4 _param', '4 __global']) &&
    JSON.stringify(json) === JSON.stringify(['3 _meta']);

}


/********************************************************************
Record one name unless the allowlist holds it.

@param {Array}  found - Findings so far
@param {Number} line  - Line number
@param {String} name  - The name
*********************************************************************/
function record (found, line, name) {

  // Every name outside the allowlist is a finding
  if (!ALLOWED_NAMES.includes(name)) {
    found.push({ line: line, name: name });
  }

}


/********************************************************************
Count the line breaks in a stretch of the source.

@param {String} source - File contents
@param {Number} start  - First index
@param {Number} end    - Index after the last

@return {Number} - Line breaks
*********************************************************************/
function countLines (source, start, end) {

  // The line breaks a skipped stretch spans
  return source.slice(start, end).split('\n').length - 1;

}


// Run as a script: the self-test, then the repository
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!runSelftest()) {
    process.stdout.write('FAIL: names-check self-test: the reader missed a planted name or read text as one\n');
    process.exit(1);
  }
  const findings = checkRepository();
  if (findings.length > 0) {
    process.stdout.write('FAIL: a name starts with an underscore. Use the plain word.\n' + findings.join('\n') + '\n');
    process.exit(1);
  }
  process.stdout.write('PASS: no name starts with an underscore\n');
}
