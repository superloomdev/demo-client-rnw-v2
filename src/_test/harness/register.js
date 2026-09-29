// Info: Pre-import hook for the test runner: registers the resolve hook.
//
// Usage: node --import ./harness/register.js --test test-*.js

import { register } from 'node:module';

register('./resolve-hook.js', import.meta.url);
