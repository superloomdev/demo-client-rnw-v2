// Info: Playwright e2e configuration. Serves the production web build with
// vite preview and starts the walk server the walker posts to. Settings are
// unconditional (no CI branch): a gate behaves identically locally and in CI.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.spec\.js$/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
    // Linux Chromium hints glyph advances to whole pixels by default, so the
    // web walker's text widths (the native gate's baseline) differed from
    // macOS, iOS and Android by up to 2.5px on short strings; unhinted
    // advances are the font's own on every platform
    launchOptions: { args: ['--font-render-hinting=none'] }
  },
  webServer: [
    {
      command: 'npx vite preview --port 4173 --strictPort',
      cwd: 'hosts/web',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 60000
    },
    {
      command: 'node scripts/walk-server.js --port 8787 --out test-results/walk',
      url: 'http://localhost:8787/health',
      reuseExistingServer: false,
      timeout: 30000
    }
  ]
});
