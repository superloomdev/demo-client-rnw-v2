// Info: Vite config for the web host. React Native Web is the web projection:
// `react-native` resolves to `react-native-web`, `.web.js` files win over
// `.js`, and react-native-svg's web build gets the asset registry it imports
// from React Native (react-native-web ships the same module). Shared source
// in ../../src and the file:-linked component library are both outside this
// project root, so both are allowed to the dev server.
import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const webNodeModules = path.resolve(__dirname, 'node_modules');
const repoRoot = path.resolve(__dirname, '../..');
const libraryRoot = path.resolve(__dirname, '../../../codebase-rnw-components-v2');

export default defineConfig({
  plugins: [
    // Shared source uses JSX in .js files (the Expo convention)
    {
      name: 'js-jsx-loader',
      enforce: 'pre',
      async transform (code, id) {
        if (/\/src\/.*\.js$/.test(id) && !id.includes('node_modules')) {
          const result = await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic', sourcemap: true });
          return { code: result.code, map: result.map };
        }
        return null;
      }
    },
    react()
  ],
  define: {
    global: 'globalThis'
  },
  resolve: {
    // Shared source in ../../src has no node_modules of its own; every bare
    // package it imports resolves from this host's install
    alias: [
      { find: /^react-native$/, replacement: path.resolve(webNodeModules, 'react-native-web') },
      { find: /^(react|react-dom|react-native-svg)$/, replacement: path.resolve(webNodeModules, '$1') },
      { find: /^@superloomdev\/(.*)$/, replacement: path.resolve(webNodeModules, '@superloomdev/$1') },
      { find: '@react-native/assets-registry/registry', replacement: path.resolve(webNodeModules, 'react-native-web/dist/modules/AssetRegistry/index.js') },
      { find: 'node:module', replacement: path.resolve(__dirname, 'node-module-stub.js') }
    ],
    // One copy of each framework even though the library lives in a sibling repo
    dedupe: ['react', 'react-dom', 'react-native-web', 'react-native-svg'],
    extensions: ['.web.js', '.js', '.jsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
      resolveExtensions: ['.web.js', '.js', '.jsx', '.json'],
      loader: { '.js': 'jsx' }
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), repoRoot, libraryRoot]
    }
  },
  preview: {
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
  }
});
