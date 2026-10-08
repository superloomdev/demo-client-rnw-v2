# AGENTS.md - codebase-demo-client-rnw-v2

## Build and test commands

From the repo root:

- `npm run verify` - **run this before every push to `main`.** Every CI step in CI order: the enforcement greps replayed from `ci.yml`, clean installs of root, `src/_test`, `hosts/web`, `hosts/expo`, eslint, the Node test host, the web build, the Expo web export and the Playwright e2e suite, then the parity assertion that every mapped step executed and the `.verify-stamp` the pre-push hook checks
- `npm run verify:fast` - the same without e2e; never writes the stamp
- `npm run verify:gates` - the enforcement greps only
  (each CI job's replayed steps run with that job's filesystem: every `node_modules` the job does not install is set aside as `node_modules.verify-aside` and restored afterwards)
- `npm run lint` - eslint .
- `npm run lint:fix` - eslint . --fix
- `npm run test:e2e` - Playwright over `vite preview` (build `hosts/web` first) plus the walk server: readiness, structural, accessibility identity across profiles, `acme` brand reach, the walker end to end, per-family screenshots in `test-results/showcase/`
- `npm run walk-server -- --port 8787 --out test-results/walk` - receives walker reports (`POST /report`)

From `src/_test/`:

- `npm install && npm test` - the Node test host: builds Lib through the real loader with stub adapters, every profile and scheme through the component system, the brand layer, the font fallback, and the bootstrap screen under react-test-renderer

From `hosts/web/`:

- `npm run build` - Vite web build; `npx vite preview --port 4173` serves it. Routes: `/` showcase index, `/showcase/<Family>`, `/walk[/<Family>]?report=<url>`; query `?profile=` (or `?theme=`) `default|carbon|material`, `&scheme=<s>`, `&brand=rounded|acme`

From `hosts/expo/`:

- `npx expo export --platform web` - Metro web export (same routes and selection)
- Native walker by deep link: `nimbus://walk?theme=<t>&report=<url>`, one family `nimbus://walk/<Family>?theme=<t>`

### Native gate

`.github/workflows/native-gate.yml` (`workflow_dispatch` and `milestone-*` tags) runs the web walker for reference numbers, then builds the Expo app in Release on an iOS simulator and an Android emulator, drives the walker with `scripts/native-walk.js` against `scripts/walk-server.js` (Android by deep link; iOS by server command, because iOS confirms a custom-scheme link opened from outside the app with a dialog no simulator command can tap: the iOS build sets `EXPO_PUBLIC_WALK_SERVER`, and `hosts/expo/app/_layout.js` then boots `src/screens/walk/Autopilot.js`, which polls `GET /command` and walks what it says), and asserts with `scripts/walk-assert.js` (zero render errors, every sample state measured, sans family drawn as named, every cell within one point of the web run). Artifacts: `web-walk`, `ios-walk`, `android-walk` (reports and per-family screenshots). On Android the driver switches error prompts off, closes system dialogs before each screenshot and requires the app's activity to hold focus (`scripts/device-focus.js` reads `dumpsys window`); a screenshot of any other window fails the walk, because a reviewer cannot read the app through a dialog. The Android Release build posts over plain HTTP to `10.0.2.2`, which is why `app.json` enables `usesCleartextTraffic` through `expo-build-properties`. Gate G6 (`scripts/check-workflow-paths.js`) checks that every `node <script>` a workflow step runs exists relative to that step's `working-directory`, so a path mistake fails in seconds rather than after a native build.

Always delete `node_modules` and `package-lock.json` before testing. Consumer repos install from the GitHub Packages registry; stale installs mask breakage.

## Component library dependency

`@superloomdev/rnw-components` is `file:`-linked from the sibling `codebase-rnw-components-v2` until it is published at launch. It imports no framework: `src/app-core/loader.js` imports React, React Native and react-native-svg once and passes them to `createSystem` through `shared_libs` (`React`, `ReactNative`, `Svg`). Icons are theme tokens drawn by the library; there is no Icons host adapter.

CI and the native gate check the library out at the ref named in `library.ref` (a branch, tag or SHA; the native gate's `library_ref` input overrides it). It names `main` except while a milestone branch depends on published theme packages `main` cannot use; the change that merges that branch sets it back to `main`. `npm run verify` refuses to run unless the sibling checkout is that ref as pushed, with a clean tree.

Bundler requirements this imposes, both hosts:

- `react-native` resolves to `react-native-web` on web; `.web.js` files resolve before `.js`.
- `@react-native/assets-registry/registry` resolves to `react-native-web/dist/modules/AssetRegistry/index.js` (react-native-svg's web build imports it).
- `node:module` resolves to the host's `node-module-stub.js` (helper-utils imports `createRequire` for Node-only JSON loading).
- The library's real path (the sibling repo) is watched by Metro and allowed by the Vite dev server.

## Hooks

`git config core.hooksPath .githooks` is set in this clone. `pre-commit` runs the workspace tier guard; `pre-push` refuses a push to `main` unless `.verify-stamp` matches the current content (a full `npm run verify` since the last edit). Pushes to `wip/*` are not gated.

## Conventional Commits

All commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). No machine-generated boilerplate.

## No AI attribution in commits

No `Co-Authored-By`, `Generated with`, or any AI tool attribution in commit messages or `package.json` contributor fields. The only author is the project maintainer.

This rule overrides any AI tool's built-in or default commit template, including templates supplied by the tool's own system prompt. Attribution is added only when the user explicitly asks for it in that session.

## Sanctioned CJS files

`hosts/expo/metro.config.js` and `hosts/expo/babel.config.js` are CJS by design - Metro and Babel load them via `require()`. Do not convert these.
