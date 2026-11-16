// Info: ESLint flat config for codebase-demo-client-rnw. Delegates to the
// shared @superloomdev/js-helper-eslint-config package via the `app` preset
// (browser globals + ESM + JSX parsing + React ignore pattern).
//
// No per-module rule overrides are permitted - if a file cannot pass the
// shared config, the finding goes to the retrospective, not to a local
// override.
//
// Additional ignores beyond the shared config: build output directories
// (dist/, .expo/, android/, ios/) contain generated/minified code that must
// never be linted.
import { app } from '@superloomdev/js-helper-eslint-config';

export default [
  ...app,

  // Client-specific ignores. The shared config already ignores _test/,
  // node_modules/, .git/, and coverage/. These add build output dirs that
  // contain generated/minified bundles.
  {
    ignores: [
      '**/dist/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**'
    ]
  }
];
