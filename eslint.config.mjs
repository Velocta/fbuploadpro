import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  tseslint.configs.eslintRecommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "old/**",
      ".specify/**",
      ".agents/**"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Type-aware linting: automatically finds the nearest tsconfig.json
        // for each file (apps/web, apps/worker, packages/*).
        projectService: {
          // Config files that aren't in any tsconfig still get linted
          // with a default project instead of erroring.
          // (Keep patterns narrow — wide globs and ** are rejected.)
          allowDefaultProject: [
            "apps/worker/vitest.config.ts",
            "packages/contracts/vitest.config.ts",
            "vitest.config.ts",
            "vitest.workspace.ts",
          ],
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-undef": "off",
      "no-empty": ["error", { "allowEmptyCatch": false }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      // --- Type-aware rules (Spec 094 / audit M23) ---
      // Catch unhandled promises — a frequent source of silent failures.
      "@typescript-eslint/no-floating-promises": "error",
      // Catch promises misused where a void/sync value is expected.
      // checksVoidReturn is off: async React event handlers (onClick={async ...})
      // are idiomatic and safe; the rule still catches conditionals, spreads, etc.
      "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": false }],
      // Catch await on non-thenables (usually a missing async or dead await).
      "@typescript-eslint/await-thenable": "error",
      // Warn on conditions that are always truthy/falsy per types.
      // Warn (not error): can false-positive on loosely-typed external data.
      "@typescript-eslint/no-unnecessary-condition": "warn"
    }
  },
  {
    files: ["**/tests/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
];
