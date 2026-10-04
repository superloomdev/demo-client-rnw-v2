// Info: Pre-import hook for the test runner: registers the resolve hook and
// supplies the one browser global the host needs (node-globals.js).
//
// Usage: node --import ./harness/register.js --test test-*.js

import { register } from 'node:module';

import './node-globals.js';

register('./resolve-hook.js', import.meta.url);
