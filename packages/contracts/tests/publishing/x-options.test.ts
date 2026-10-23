import { describe, expect, it } from 'vitest';
import {
  countXWeightedCharacters,
  validateXMedia,
  validateXPlatformOptions,
  validateXText,
  X_MAX_WEIGHTED_CHARACTERS,
  XPlatformOptionsSchema,
} from '../../src/publishing/x-options.js';

// ==========================================
// Weighted-character validation (spec 127 Scope.3)
// ==========================================

describe('X weighted characters', () => {
  it('counts plain Latin text at 1 per character', () => {
    expect(countXWeightedCharacters('Hello world')).toBe(11);
    expect(countXWeightedCharacters('')).toBe(0);
  });

  it('counts CJK characters at 2 each', () => {
    expect(countXWeightedCharacters('你好世界')).toBe(8); // Chinese
    expect(countXWeightedCharacters('こんにちは')).toBe(10); // Hiragana
    expect(countXWeightedCharacters('カタカナ')).toBe(8); // Katakana
    expect(countXWeightedCharacters('한국어')).toBe(6); // Hangul
    expect(countXWeightedCharacters('a你b')).toBe(4); // mixed
  });

  it('counts an emoji at 2, including sequences as one visible emoji', () => {
    expect(countXWeightedCharacters('😀')).toBe(2);
    expect(countXWeightedCharacters('Hi 😀!')).toBe(6);
    // ZWJ family sequence: several code points, one visible emoji.
    expect(countXWeightedCharacters('👨‍👩‍👧‍👦')).toBe(2);
    // Skin-tone variant: one visible emoji.
    expect(countXWeightedCharacters('👍🏽')).toBe(2);
    // Regional-indicator flag: one visible emoji.
    expect(countXWeightedCharacters('🇬🇧')).toBe(2);
  });

  it('counts any URL as exactly 23, whatever its length', () => {
    expect(countXWeightedCharacters('https://x.com')).toBe(23);
    expect(
      countXWeightedCharacters(
        'https://example.com/a/very/long/path?with=query&params=that_go_on_and_on'
      )
    ).toBe(23);
    expect(countXWeightedCharacters('See https://example.com now')).toBe(4 + 23 + 4);
    expect(
      countXWeightedCharacters('https://a.example https://b.example')
    ).toBe(23 + 1 + 23);
  });

  it('enforces the 280 limit on the weighted count, not the raw length', () => {
    expect(validateXText('a'.repeat(280))).toEqual({
      valid: true,
      weightedLength: 280,
      remaining: 0,
    });
    expect(validateXText('a'.repeat(281)).valid).toBe(false);
    // 140 CJK characters exactly fill the budget at weight 2.
    expect(validateXText('漢'.repeat(140)).valid).toBe(true);
    expect(validateXText('漢'.repeat(141)).valid).toBe(false);
    // A raw-short post can still overflow once weighting applies.
    const withUrl = validateXText(`${'a'.repeat(258)} https://example.com`);
    expect(withUrl.weightedLength).toBe(258 + 1 + 23);
    expect(withUrl.valid).toBe(false);
    expect(X_MAX_WEIGHTED_CHARACTERS).toBe(280);
  });
});

// ==========================================
// platform_options (spec 127 Scope.3)
// ==========================================

describe('X platform options', () => {
  it('accepts empty options and each supported field', () => {
    expect(validateXPlatformOptions({}, { hasMedia: false }).valid).toBe(true);
    expect(
      validateXPlatformOptions(
        { poll: { options: ['Yes', 'No'], durationMinutes: 60 } },
        { hasMedia: false }
      ).valid
    ).toBe(true);
    expect(
      validateXPlatformOptions(
        { replySettings: 'mentionedUsers' },
        { hasMedia: false }
      ).valid
    ).toBe(true);
    expect(
      validateXPlatformOptions({ quoteTweetId: '123456' }, { hasMedia: false }).valid
    ).toBe(true);
    expect(
      validateXPlatformOptions({ altText: 'A chart of results' }, { hasMedia: true }).valid
    ).toBe(true);
  });

  it('enforces poll bounds: 2–4 options, ≤25 chars each, 5 min – 7 days', () => {
    const base = { options: ['A', 'B'], durationMinutes: 60 };
    expect(
      validateXPlatformOptions({ poll: { ...base, options: ['Only'] } }, { hasMedia: false })
        .valid
    ).toBe(false);
    expect(
      validateXPlatformOptions(
        { poll: { ...base, options: ['1', '2', '3', '4', '5'] } },
        { hasMedia: false }
      ).valid
    ).toBe(false);
    expect(
      validateXPlatformOptions(
        { poll: { ...base, options: ['x'.repeat(26), 'B'] } },
        { hasMedia: false }
      ).valid
    ).toBe(false);
    expect(
      validateXPlatformOptions(
        { poll: { ...base, options: ['x'.repeat(25), 'B'] } },
        { hasMedia: false }
      ).valid
    ).toBe(true);
    expect(
      validateXPlatformOptions({ poll: { ...base, durationMinutes: 4 } }, { hasMedia: false })
        .valid
    ).toBe(false);
    expect(
      validateXPlatformOptions({ poll: { ...base, durationMinutes: 5 } }, { hasMedia: false })
        .valid
    ).toBe(true);
    expect(
      validateXPlatformOptions(
        { poll: { ...base, durationMinutes: 7 * 24 * 60 } },
        { hasMedia: false }
      ).valid
    ).toBe(true);
    expect(
      validateXPlatformOptions(
        { poll: { ...base, durationMinutes: 7 * 24 * 60 + 1 } },
        { hasMedia: false }
      ).valid
    ).toBe(false);
  });

  it('rejects a poll combined with media (X platform rule)', () => {
    const result = validateXPlatformOptions(
      { poll: { options: ['Yes', 'No'], durationMinutes: 60 } },
      { hasMedia: true }
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Polls cannot be combined with media');
  });

  it('contains NO thread/reply-chain field — thread keys fail validation', () => {
    expect(XPlatformOptionsSchema.safeParse({ thread: ['a', 'b'] }).success).toBe(false);
    expect(XPlatformOptionsSchema.safeParse({ replyToId: '123' }).success).toBe(false);
    expect(XPlatformOptionsSchema.safeParse({ reply_to_id: '123' }).success).toBe(false);
    expect(
      validateXPlatformOptions({ thread: ['a'] }, { hasMedia: false }).valid
    ).toBe(false);
  });
});

// ==========================================
// Media limits
// ==========================================

describe('X media limits (conservative v1 spec)', () => {
  it('enforces image ≤5 MB, GIF ≤15 MB, video ≤512 MB / 0.5–140 s', () => {
    expect(validateXMedia({ mediaType: 'image', fileSizeBytes: 5 * 1024 * 1024 }).valid).toBe(
      true
    );
    expect(
      validateXMedia({ mediaType: 'image', fileSizeBytes: 5 * 1024 * 1024 + 1 }).valid
    ).toBe(false);
    expect(validateXMedia({ mediaType: 'gif', fileSizeBytes: 15 * 1024 * 1024 }).valid).toBe(
      true
    );
    expect(
      validateXMedia({ mediaType: 'gif', fileSizeBytes: 15 * 1024 * 1024 + 1 }).valid
    ).toBe(false);
    expect(
      validateXMedia({
        mediaType: 'video',
        fileSizeBytes: 512 * 1024 * 1024,
        durationSeconds: 140,
      }).valid
    ).toBe(true);
    expect(
      validateXMedia({ mediaType: 'video', fileSizeBytes: 512 * 1024 * 1024 + 1 }).valid
    ).toBe(false);
    expect(validateXMedia({ mediaType: 'video', durationSeconds: 141 }).valid).toBe(false);
    expect(validateXMedia({ mediaType: 'video', durationSeconds: 0.4 }).valid).toBe(false);
    expect(validateXMedia({ mediaType: 'video', durationSeconds: 0.5 }).valid).toBe(true);
  });
});
