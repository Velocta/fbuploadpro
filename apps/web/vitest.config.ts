import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Spec 137-A3 (T30): Vitest project split.
 *
 * - `node` project: the existing API / security / domain / lib / middleware
 *   suites. Their environment and behaviour are untouched.
 * - `jsdom` project: component / UI tests. They render into a real DOM
 *   (jsdom) and assert on behaviour — interaction, keyboard, focus, async
 *   states — via Testing Library + user-event + jest-dom matchers wired in
 *   `tests/setup/jsdom.setup.ts`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
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
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/**/*.test.ts',
            'tests/api/**/*.test.ts',
            'tests/auth/**/*.test.ts',
            'tests/domain/**/*.test.ts',
            'tests/lib/**/*.test.ts',
            'tests/middleware/**/*.test.ts',
            'tests/security/**/*.test.ts',
            'tests/unit/**/*.test.ts',
            // Static-render + pure-logic suite: it asserts behaviour
            // "outside the browser" (no window), so it stays on node even
            // though it lives under tests/ui.
            'tests/ui/platform-settings-tabs.test.tsx',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            // Runs in the node project instead — see its include note.
            '**/tests/ui/platform-settings-tabs.test.tsx',
          ],
          setupFiles: ['./tests/setup/jsdom.setup.ts'],
          include: [
            'src/**/*.test.tsx',
            'tests/auth/**/*.test.tsx',
            'tests/components/**/*.test.tsx',
            'tests/ui/**/*.test.{ts,tsx}',
            'tests/unit/**/*.test.tsx',
          ],
        },
      },
    ],
  },
});
