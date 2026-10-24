/**
 * Theme-init script hash drift guard (spec 139, CSP Phase 2).
 *
 * Under enforcing CSP the inline themeInitScript in src/app/layout.tsx
 * runs only because script-src carries its SHA-256 hash. If anyone edits
 * that script without updating THEME_INIT_SCRIPT_SHA256 in src/lib/csp.ts,
 * the hash stops matching and the browser blocks the script — theming
 * breaks silently in production. This suite recomputes the hash from the
 * layout source and fails CI on any drift, so the edit cannot land
 * without the matching hash update.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  THEME_INIT_SCRIPT_SHA256,
  buildContentSecurityPolicy,
} from '../../src/lib/csp';

const ESCAPED_CHARS: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
  '\\': '\\',
  '`': '`',
  $: '$',
  "'": "'",
  '"': '"',
};

/**
 * Evaluate the escape sequences of a JavaScript template literal the way
 * the runtime does, so the hashed bytes are the exact script body the
 * browser receives — not the raw source text (e.g. `\\s` in the source
 * is a single `\s` in the evaluated string). Unknown escapes drop the
 * backslash, matching JS string semantics.
 */
function evaluateTemplateLiteral(raw: string): string {
  let result = '';
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i] as string;
    if (char !== '\\' || i + 1 >= raw.length) {
      result += char;
      continue;
    }
    const next = raw[i + 1] as string;
    result += ESCAPED_CHARS[next] ?? next;
    i += 1;
  }
  return result;
}

function extractThemeInitScript(layoutSource: string): string {
  const declaration = 'const themeInitScript = `';
  const start = layoutSource.indexOf(declaration);
  expect(start, 'themeInitScript declaration not found in layout.tsx').toBeGreaterThan(-1);
  const bodyStart = start + declaration.length;
  const end = layoutSource.indexOf('`;', bodyStart);
  expect(end, 'themeInitScript template literal is not terminated').toBeGreaterThan(-1);
  return evaluateTemplateLiteral(layoutSource.slice(bodyStart, end));
}

function sha256Base64(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64');
}

describe('themeInitScript CSP hash (spec 139)', () => {
  const layoutSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/layout.tsx'),
    'utf8'
  );
  const scriptBody = extractThemeInitScript(layoutSource);

  it('extracts the real theme-init script body', () => {
    expect(scriptBody).toContain('localStorage.getItem');
    expect(scriptBody).toContain('fbup_theme');
    expect(scriptBody).toContain('document.documentElement.dataset.theme');
  });

  it('matches the SHA-256 hash pinned in src/lib/csp.ts', () => {
    expect(sha256Base64(scriptBody)).toBe(THEME_INIT_SCRIPT_SHA256);
  });

  it('is the hash buildContentSecurityPolicy puts in script-src', () => {
    const scriptSrc = buildContentSecurityPolicy('anynonce')
      .split('; ')
      .find((directive) => directive.startsWith('script-src'));
    expect(scriptSrc).toContain(`'sha256-${sha256Base64(scriptBody)}'`);
  });
});
