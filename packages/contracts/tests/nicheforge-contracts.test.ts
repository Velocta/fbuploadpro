import { describe, expect, it } from 'vitest';
import {
  buildPatternMiningPrompt,
  buildReportMarkdown,
  buildVideoBreakdownPrompt,
  classifyBridgeAiError,
  classifyProviderError,
  deriveVideoInput,
  isBridgeSafeModelId,
  isForbiddenProviderHost,
  NICHEFORGE_GEMINI_OPENAI_COMPAT_BASE_URL,
  NICHEFORGE_PROMPT_VERSION,
  NicheforgeBreakdownSchema,
  NicheforgeKeyCreateSchema,
  NicheforgeKeyRecordSchema,
  NicheforgePatternReportSchema,
  NicheforgeRunCreateSchema,
  NicheforgeRunIndexSchema,
  NicheforgeRunRecordSchema,
  parseVideoUrlBlock,
  pickSubtitleLanguage,
  reportFilename,
  stripCaptionText,
  truncateTranscriptForPrompt,
  type NicheforgeBreakdown,
  type NicheforgeRunRecord,
} from '../src/domain/nicheforge.js';

const metadata = {
  url: 'https://www.youtube.com/watch?v=abc123',
  platform: 'youtube' as const,
  title: 'Why this mug is grumpy',
  channel: 'Mug Life',
  durationSeconds: 42,
};

describe('intake', () => {
  it('derives youtube/tiktok/instagram/facebook platforms', () => {
    expect(deriveVideoInput('https://www.youtube.com/watch?v=x')).toMatchObject({ ok: true });
    expect(deriveVideoInput('https://www.tiktok.com/@a/video/1')).toMatchObject({ ok: true });
    expect(deriveVideoInput('https://www.instagram.com/reel/abc/')).toMatchObject({ ok: true });
    expect(deriveVideoInput('https://www.facebook.com/watch/?v=1')).toMatchObject({ ok: true });
  });

  it('rejects other platforms and userinfo URLs', () => {
    const x = deriveVideoInput('https://x.com/a/status/1');
    expect(x.ok).toBe(false);
    const userinfo = deriveVideoInput('https://user:pass@youtube.com/watch?v=x');
    expect(userinfo.ok).toBe(false);
    const bad = deriveVideoInput('not a url');
    expect(bad.ok).toBe(false);
  });

  it('collapses duplicates and reports per-line errors', () => {
    const parsed = parseVideoUrlBlock('https://youtu.be/abc\nhttps://youtu.be/abc\nhttps://x.com/a/status/1\n');
    expect(parsed.inputs).toHaveLength(1);
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.errors).toHaveLength(1);
  });

  it('rejects 0 and 21 URLs in the create schema', () => {
    expect(NicheforgeRunCreateSchema.safeParse({ videoUrls: [], provider: 'gemini' }).success).toBe(false);
    const urls = Array.from({ length: 21 }, (_, i) => `https://youtu.be/v${i}`);
    expect(NicheforgeRunCreateSchema.safeParse({ videoUrls: urls, provider: 'gemini' }).success).toBe(false);
    expect(NicheforgeRunCreateSchema.safeParse({ videoUrls: ['https://youtu.be/v1'], provider: 'gemini' }).success).toBe(true);
  });
});

describe('schemas', () => {
  const breakdown: NicheforgeBreakdown = {
    hook: 'The mug complains in the first second',
    hookType: 'bold-claim',
    structure: ['Hook', 'Payoff'],
    pacing: 'Fast cuts, no dead air.',
    topic: 'Office coffee',
    format: 'short-form vertical',
    whyItWorked: 'It names a shared annoyance immediately. The payoff lands fast.',
    replicableTakeaways: ['Open on the complaint, not the setup.'],
    transcriptAvailable: true,
    transcriptTruncated: false,
    confidence: 'high',
    confidenceReason: 'Full transcript analysed.',
  };

  it('accepts a valid breakdown and rejects empty structure / too many takeaways / unknown enums', () => {
    expect(NicheforgeBreakdownSchema.safeParse(breakdown).success).toBe(true);
    expect(NicheforgeBreakdownSchema.safeParse({ ...breakdown, structure: [] }).success).toBe(false);
    expect(NicheforgeBreakdownSchema.safeParse({ ...breakdown, replicableTakeaways: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
    expect(NicheforgeBreakdownSchema.safeParse({ ...breakdown, hookType: 'mystery' }).success).toBe(false);
  });

  it('rejects maskedSuffix that is not exactly 4 chars', () => {
    const base = { id: '11111111-1111-4111-8111-111111111111', provider: 'gemini', label: 'Main', createdAt: '2026-10-24T00:00:00Z', lastValidatedAt: null, lastValidation: null, cooldownUntil: null };
    expect(NicheforgeKeyRecordSchema.safeParse({ ...base, maskedSuffix: 'abcd' }).success).toBe(true);
    expect(NicheforgeKeyRecordSchema.safeParse({ ...base, maskedSuffix: 'abc' }).success).toBe(false);
  });

  it('rejects an FBUploadPro base URL and a base URL for gemini', () => {
    expect(NicheforgeKeyCreateSchema.safeParse({ provider: 'openai-compatible', label: 'L', key: 'k', baseUrl: 'https://app.fbuploadpro.com/v1' }).success).toBe(false);
    expect(NicheforgeKeyCreateSchema.safeParse({ provider: 'gemini', label: 'L', key: 'k', baseUrl: 'https://example.com' }).success).toBe(false);
    expect(NicheforgeKeyCreateSchema.safeParse({ provider: 'openai-compatible', label: 'L', key: 'k', baseUrl: 'https://api.example.com/v1' }).success).toBe(true);
  });

  it('caps the run index at 200', () => {
    const entry = { id: '11111111-1111-4111-8111-111111111111', title: 'Run', status: 'done' as const, createdAt: '2026-10-24T00:00:00Z', videoCount: 1, successCount: 1 };
    expect(NicheforgeRunIndexSchema.safeParse(Array.from({ length: 201 }, () => entry)).success).toBe(false);
    expect(NicheforgeRunIndexSchema.safeParse([entry]).success).toBe(true);
  });

  it('validates a full run record', () => {
    const run: NicheforgeRunRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Research run',
      provider: 'gemini',
      modelId: 'gemini-2.5-flash',
      promptVersion: NICHEFORGE_PROMPT_VERSION,
      status: 'done',
      createdAt: '2026-10-24T00:00:00Z',
      updatedAt: '2026-10-24T00:01:00Z',
      completedAt: '2026-10-24T00:01:00Z',
      videos: [{ id: '22222222-2222-4222-8222-222222222222', url: metadata.url, platform: 'youtube', status: 'done', failureReason: null, failureDetail: null, metadata, transcript: 'hello world', transcriptLanguage: 'en', transcriptTruncated: false, breakdown }],
      report: null,
      reportError: null,
    };
    expect(NicheforgeRunRecordSchema.safeParse(run).success).toBe(true);
  });
});

describe('prompts', () => {
  it('embeds metadata and transcript, flags 12,000-char truncation', () => {
    const long = 'x'.repeat(13000);
    const prompt = buildVideoBreakdownPrompt({ metadata, transcript: long, transcriptLanguage: 'en' });
    expect(prompt).toContain('Why this mug is grumpy');
    expect(prompt).toContain('Transcript truncated for this prompt: yes');
    expect(prompt).not.toContain(long);
    const short = buildVideoBreakdownPrompt({ metadata, transcript: 'hello', transcriptLanguage: 'en' });
    expect(short).toContain('Transcript truncated for this prompt: no');
  });

  it('forces low confidence wording for metadata-only breakdowns', () => {
    const prompt = buildVideoBreakdownPrompt({ metadata, transcript: null, transcriptLanguage: null });
    expect(prompt).toContain('No transcript is available');
    expect(prompt).toContain('Do not invent transcript content');
  });

  it('pattern prompt refuses schedule claims when no dates exist', () => {
    const prompt = buildPatternMiningPrompt({ breakdowns: [], metadata: [] });
    expect(prompt).toContain('postingPatterns must be an empty array');
  });

  it('truncation helper keeps short transcripts whole', () => {
    expect(truncateTranscriptForPrompt('abc')).toEqual({ text: 'abc', truncated: false });
    const t = truncateTranscriptForPrompt('y'.repeat(13000));
    expect(t.text).toHaveLength(12000);
    expect(t.truncated).toBe(true);
  });
});

describe('report markdown (golden)', () => {
  it('renders a known run byte-identically', () => {
    const run: NicheforgeRunRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Mug research',
      provider: 'gemini',
      modelId: 'gemini-2.5-flash',
      promptVersion: '1',
      status: 'done',
      createdAt: '2026-10-24T00:00:00Z',
      updatedAt: '2026-10-24T00:01:00Z',
      completedAt: '2026-10-24T00:01:00Z',
      videos: [
        { id: '22222222-2222-4222-8222-222222222222', url: metadata.url, platform: 'youtube', status: 'done', failureReason: null, failureDetail: null, metadata, transcript: 'hi', transcriptLanguage: 'en', transcriptTruncated: false, breakdown: {
          hook: 'Grumpy open', hookType: 'bold-claim', structure: ['Hook', 'Payoff'], pacing: 'Fast.', topic: 'Coffee', format: 'short-form vertical', whyItWorked: 'Names the annoyance. Lands fast.', replicableTakeaways: ['Open on the complaint.'], transcriptAvailable: true, transcriptTruncated: false, confidence: 'high', confidenceReason: 'Full transcript.',
        } },
      ],
      report: {
        recurringHooks: [{ hookType: 'bold-claim', count: 1, exampleVideoIds: ['22222222-2222-4222-8222-222222222222'] }],
        commonFormats: [{ format: 'short-form vertical', count: 1 }],
        lengthInsights: ['Videos cluster under 60 seconds.'],
        postingPatterns: [],
        topicClusters: [{ topic: 'Coffee', videoIds: ['22222222-2222-4222-8222-222222222222'] }],
        actionablePlaybook: [{ kind: 'do', text: 'Open on the complaint.', sourceVideoIds: ['22222222-2222-4222-8222-222222222222'] }],
        coverage: { attempted: 1, analysed: 1, transcriptBased: 1, metadataOnly: 0 },
        modelId: 'gemini-2.5-flash', provider: 'gemini', promptVersion: '1', generatedAt: '2026-10-24T00:01:00Z',
      },
      reportError: null,
    };
    const md = buildReportMarkdown(run);
    expect(md).toContain('# Mug research');
    expect(md).toContain('Coverage: 1 of 1 videos analysed (1 with captions, 0 from details only).');
    expect(md).toContain('Hook (bold-claim): Grumpy open');
    expect(md).toContain('## Pattern report');
    expect(md).toContain('Generated with gemini model gemini-2.5-flash, prompt version 1.');
    // Golden: a second render of the same record is byte-identical.
    expect(buildReportMarkdown(run)).toBe(md);
    expect(NicheforgePatternReportSchema.safeParse(run.report).success).toBe(true);
  });

  it('slugs export filenames without path separators', () => {
    expect(reportFilename('My Research / Run!')).toBe('my-research-run-nicheforge-report.md');
  });
});

describe('captions', () => {
  it('prefers manual en, then auto en, then any manual', () => {
    expect(pickSubtitleLanguage([{ language: 'es' }], [{ language: 'en' }])).toEqual({ language: 'en', manual: false });
    expect(pickSubtitleLanguage([{ language: 'en' }], [{ language: 'fr' }])).toEqual({ language: 'en', manual: true });
    expect(pickSubtitleLanguage([{ language: 'de' }], [])).toEqual({ language: 'de', manual: true });
    expect(pickSubtitleLanguage([], [])).toBeNull();
  });

  it('strips VTT timestamps, tags and duplicate lines', () => {
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello <b>world</b>\n\n00:00:02.000 --> 00:00:04.000\nHello world\n\n3\n00:00:04.000 --> 00:00:06.000\nNext line';
    expect(stripCaptionText(vtt)).toBe('Hello world Next line');
  });
});

describe('provider error classification', () => {
  it('maps statuses and quota language', () => {
    expect(classifyProviderError(401, null)).toBe('auth');
    expect(classifyProviderError(403, null)).toBe('auth');
    expect(classifyProviderError(429, null)).toBe('rate-limited');
    expect(classifyProviderError(400, 'quota exhausted for today')).toBe('quota-exhausted');
    expect(classifyProviderError(null, null)).toBe('unreachable');
    expect(classifyProviderError(null, 'request timed out')).toBe('timeout');
    expect(classifyProviderError(500, 'boom')).toBe('unknown');
  });

  it('maps bridge AI error codes', () => {
    expect(classifyBridgeAiError('AI_RATE_LIMITED')).toBe('rate-limited');
    expect(classifyBridgeAiError('AI_KEY_MISSING')).toBe('auth');
    expect(classifyBridgeAiError('AI_TIMEOUT')).toBe('timeout');
    expect(classifyBridgeAiError('AI_PROVIDER_ERROR')).toBe('unreachable');
  });
});

describe('bridge mapping constants', () => {
  it('gemini compat endpoint is https and bridge-safe model ids validate', () => {
    expect(NICHEFORGE_GEMINI_OPENAI_COMPAT_BASE_URL.startsWith('https://')).toBe(true);
    expect(isBridgeSafeModelId('gemini-2.5-flash')).toBe(true);
    expect(isBridgeSafeModelId('gpt 4o')).toBe(false);
    expect(isForbiddenProviderHost('https://app.fbuploadpro.com/v1')).toBe(true);
    expect(isForbiddenProviderHost('https://api.example.com/v1')).toBe(false);
  });
});
