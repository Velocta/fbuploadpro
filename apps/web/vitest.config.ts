import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
    // Playwright specs (tests/e2e/**, spec 137-A3) are not Vitest tests —
    // PR-A6 carries the updated login spec on this stack, so the exclude
    // lands here; PR-A3's project-split config supersedes it on merge.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
      // Spec 137 §3.4.3: the new architecture modules are held to 100%
      // line coverage by their own suites. Scoped per-glob so no
      // repo-wide coverage mandate is introduced; PR-A3 owns the
      // wider test-harness migration.
      thresholds: {
        'src/lib/api/**': { lines: 100 },
        'src/lib/data/**': { lines: 100 },
        'src/lib/storage/**': { lines: 100 },
        'src/lib/report-error.ts': { lines: 100 },
      },
    },
  },
});
