/**
 * Font-delivery drift guard (spec 137 §3.6.3 / PR-A4).
 *
 * The system stack is declared in src/app/fonts.ts and carried by the
 * design-token pipeline (tokens/primitive.json -> generated CSS) and
 * the legacy theme export. The typeface is a deliberate, wired choice;
 * these assertions fail if any copy of the stack drifts from the
 * others, so the formalised configuration cannot silently fork.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FONT_MONO_STACK,
  FONT_SANS_STACK,
  FONT_MONO_VARIABLE,
  FONT_SANS_VARIABLE,
} from '@/app/fonts';
import { TYPOGRAPHY } from '@/lib/theme';

const generatedCss = readFileSync(
  path.resolve(process.cwd(), 'src/styles/tokens.generated.css'),
  'utf8'
);
const primitiveTokens = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'tokens/primitive.json'), 'utf8')
) as {
  font: { family: { sans: { $value: string }; mono: { $value: string } } };
};

describe('font delivery (spec 137 §3.6.3)', () => {
  it('declares the shipped system stacks — no typeface change', () => {
    expect(FONT_SANS_STACK).toBe(
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    );
    expect(FONT_MONO_STACK).toBe(
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
    );
  });

  it('matches the token source of truth (tokens/primitive.json)', () => {
    expect(primitiveTokens.font.family.sans.$value).toBe(FONT_SANS_STACK);
    expect(primitiveTokens.font.family.mono.$value).toBe(FONT_MONO_STACK);
  });

  it('matches the generated token variables the layout consumes', () => {
    expect(generatedCss).toContain(`${FONT_SANS_VARIABLE}: ${FONT_SANS_STACK};`);
    expect(generatedCss).toContain(`${FONT_MONO_VARIABLE}: ${FONT_MONO_STACK};`);
  });

  it('matches the theme export components still consume', () => {
    expect(TYPOGRAPHY.fontFamily).toBe(FONT_SANS_STACK);
    expect(TYPOGRAPHY.mono).toBe(FONT_MONO_STACK);
  });
});
