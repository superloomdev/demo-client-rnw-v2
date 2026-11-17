// Info: Pre-import hook for the test runner: registers the resolve hook and
// supplies the two browser globals the host needs (node-globals.js).
//
// `assert-guard.js` loads first: it keeps live objects (rendered instances,
// DOM nodes) out of assertion failures, for every test file.
//
// Usage: node --import ./harness/register.js --test test-*.js

import { register } from 'node:module';

import './assert-guard.js';
import './node-globals.js';

register('./resolve-hook.js', import.meta.url);
