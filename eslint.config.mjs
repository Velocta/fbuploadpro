import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "old/**"
    ]
  },
  {
    rules: {
      "no-unused-vars": "off"
    }
  }
];
