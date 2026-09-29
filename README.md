# demo-client-rnw-v2

The proving ground for the generic Superloom React Native Web component library: one shared app source (`src/`) rendered by two hosts - Vite for web (`hosts/web/`) and Expo with Metro for web, iOS and Android (`hosts/expo/`) - under every template the library supports, with sparse brand layers on top.

## Layout

| Path | Holds |
|---|---|
| `src/app-core/` | The loader (the one place frameworks and helpers are imported), the Lib and theme contexts, config |
| `src/themes/` | Building the component system from a built theme; brand layers |
| `src/fonts/` | The font manifest over the host's font adapter |
| `src/screens/` | Screens, shared by both hosts |
| `src/_test/` | The Node test host |
| `hosts/web/`, `hosts/expo/` | Host entries, bundler config and the two host adapters (Navigation, Fonts) |

## Selecting a theme

Both hosts read `?profile=default|carbon|material`, `&scheme=<name>` (a scheme of that profile, first by default) and `&brand=<name>` (a key of `src/themes/brand-layers.js`).

## Commands

See `AGENTS.md`.
