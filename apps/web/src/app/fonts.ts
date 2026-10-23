/**
 * Font delivery (spec 137 §3.6.3 / PR-A4) — the system stack, chosen
 * and wired deliberately.
 *
 * The product's typeface is the operating system's UI stack. That was
 * previously true by absence (no webfont was ever loaded, and nothing
 * said so); this module makes it the formal configuration:
 *
 * - The stacks below are the single declaration of the choice. The
 *   design-token pipeline carries the same values
 *   (`tokens/primitive.json` font.family, generated to
 *   `--font-family-sans` / `--font-family-mono` in
 *   `src/styles/tokens.generated.css`, surfaced to Tailwind as
 *   `--font-sans` / `--font-mono` in globals.css `@theme`), and
 *   `tests/fonts.test.ts` fails if the copies ever drift apart.
 * - The root layout applies the stack through the token-backed
 *   `font-sans` utility (see `fontSansClassName`), so the wired path
 *   is layout → token utility → generated token variable → stack.
 * - `font-display: swap` semantics: a system stack has no downloadable
 *   font, so there is no block/swap period at all — first paint uses
 *   the local UI font immediately, which is strictly better than swap.
 *
 * Why not a `next/font` loader: next/font's google and local loaders
 * exist to download or self-host font *files*. A system stack has no
 * files to load, so there is nothing for a loader to do; using one
 * would require adopting a downloadable typeface, which is an identity
 * change and an explicit non-goal of this spec (§8). The typeface,
 * weights and scale are unchanged by this PR — only the delivery is
 * formalised.
 */

/** Sans stack — identical to the tokens' font.family.sans value. */
export const FONT_SANS_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' as const;

/** Mono stack — identical to the tokens' font.family.mono value. */
export const FONT_MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace' as const;

/** Generated token variables carrying the stacks (globals.css @theme maps them to --font-sans/--font-mono). */
export const FONT_SANS_VARIABLE = '--font-family-sans' as const;
export const FONT_MONO_VARIABLE = '--font-family-mono' as const;

/**
 * Token-backed Tailwind utilities the root layout applies. `font-sans`
 * resolves through globals.css @theme to the generated
 * --font-family-sans variable, i.e. FONT_SANS_STACK.
 */
export const fontSansClassName = 'font-sans';
export const fontMonoClassName = 'font-mono';
