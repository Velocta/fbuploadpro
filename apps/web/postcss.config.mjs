/**
 * PostCSS wiring for apps/web (spec 129, PR-F2).
 * Tailwind CSS v4 runs as a PostCSS plugin; see src/app/globals.css for the
 * layered global stylesheet fed by the generated design tokens.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
