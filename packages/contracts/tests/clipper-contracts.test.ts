/**
 * Spec 148 contracts tests — schema accept/reject matrix (plan §1).
 * A clip with no reason is a bug: the schema rejects it, so the UI can
 * never render a reason-less clip that slipped past the scorer.
 */
import { describe, expect, it } from 'vitest';
import {
  ClipErrorSchema,
  ClipJobCreateSchema,
  ClipJobListSchema,
  ClipJobSchema,
  ClipSelectionSchema,
  TranscriptSegmentSchema,
  type ClipJob,
  type ClipSelection,
} from '../src/domain/clipper.js';

function validClip(overrides: Partial<ClipSelection> = {}): ClipSelection {
  return {
    id: 'clip-1',
    startSeconds: 10,
    endSeconds: 40,
    durationSeconds: 30,
    excerpt: 'Why does this always happen on Mondays?',
    reasons: ['question'],
    score: 80,
    aiRanked: false,
    exportStatus: 'pending',
    ...overrides,
  };
}

function validJob(overrides: Partial<ClipJob> = {}): ClipJob {
  return {
    id: 'job-1',
    schemaVersion: 1,
    sourceName: 'talk.mp4',
    sourcePathHash: 'abc123',
    sourceDurationSeconds: 600,
    model: 'base',
    clipCount: 5,
    aspect: 'vertical',
    status: 'ready',
    stagePercent: 100,
    clips: [validClip()],
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('TranscriptSegmentSchema', () => {
  it('accepts a valid segment', () => {
    expect(TranscriptSegmentSchema.safeParse({ startSeconds: 0, endSeconds: 3.5, text: 'Hello there.' }).success).toBe(true);
  });
  it('rejects empty text', () => {
    expect(TranscriptSegmentSchema.safeParse({ startSeconds: 0, endSeconds: 3.5, text: '   ' }).success).toBe(false);
  });
  it('rejects end <= start', () => {
    expect(TranscriptSegmentSchema.safeParse({ startSeconds: 5, endSeconds: 5, text: 'Hi.' }).success).toBe(false);
  });
  it('rejects negative timestamps', () => {
    expect(TranscriptSegmentSchema.safeParse({ startSeconds: -1, endSeconds: 3, text: 'Hi.' }).success).toBe(false);
  });
});

describe('ClipSelectionSchema', () => {
  it('accepts a valid clip', () => {
    expect(ClipSelectionSchema.safeParse(validClip()).success).toBe(true);
  });
  it('rejects an empty reasons array', () => {
    expect(ClipSelectionSchema.safeParse(validClip({ reasons: [] })).success).toBe(false);
  });
  it('rejects an unknown reason', () => {
    expect(ClipSelectionSchema.safeParse(validClip({ reasons: ['viral'] as never })).success).toBe(false);
  });
  it('rejects end <= start', () => {
    expect(ClipSelectionSchema.safeParse(validClip({ endSeconds: 10 })).success).toBe(false);
  });
  it('rejects a duration that does not match the window', () => {
    expect(ClipSelectionSchema.safeParse(validClip({ durationSeconds: 5 })).success).toBe(false);
  });
  it('rejects an empty excerpt', () => {
    expect(ClipSelectionSchema.safeParse(validClip({ excerpt: '  ' })).success).toBe(false);
  });
  it('accepts AI ranking fields', () => {
    expect(
      ClipSelectionSchema.safeParse(validClip({ aiRanked: true, aiReason: 'Strong hook and clear payoff.' })).success,
    ).toBe(true);
  });
});

describe('ClipJobSchema', () => {
  it('accepts a valid job', () => {
    expect(ClipJobSchema.safeParse(validJob()).success).toBe(true);
  });
  it('rejects failed without an error', () => {
    expect(ClipJobSchema.safeParse(validJob({ status: 'failed' })).success).toBe(false);
  });
  it('rejects cancelled with an error', () => {
    expect(
      ClipJobSchema.safeParse(
        validJob({ status: 'cancelled', error: { code: 'BRIDGE_ERROR', message: 'x' } }),
      ).success,
    ).toBe(false);
  });
  it('accepts failed with an error', () => {
    expect(
      ClipJobSchema.safeParse(
        validJob({ status: 'failed', error: { code: 'NO_SPEECH_DETECTED', message: 'No speech was found in this video.' } }),
      ).success,
    ).toBe(true);
  });
  it('rejects an unknown error code', () => {
    expect(ClipErrorSchema.safeParse({ code: 'SOMETHING_ELSE', message: 'x' }).success).toBe(false);
  });
  it('rejects clipCount 0 and 11', () => {
    expect(ClipJobSchema.safeParse(validJob({ clipCount: 0 })).success).toBe(false);
    expect(ClipJobSchema.safeParse(validJob({ clipCount: 11 })).success).toBe(false);
  });
  it('rejects stagePercent 101', () => {
    expect(ClipJobSchema.safeParse(validJob({ stagePercent: 101 })).success).toBe(false);
  });
  it('rejects a job list over 20 jobs', () => {
    const jobs = Array.from({ length: 21 }, (_, i) => validJob({ id: `job-${i}` }));
    expect(ClipJobListSchema.safeParse({ jobs }).success).toBe(false);
  });
});

describe('ClipJobCreateSchema', () => {
  it('accepts base/5/vertical', () => {
    expect(ClipJobCreateSchema.safeParse({ model: 'base', clipCount: 5, aspect: 'vertical' }).success).toBe(true);
  });
  it('rejects an unknown model', () => {
    expect(ClipJobCreateSchema.safeParse({ model: 'large', clipCount: 5, aspect: 'vertical' }).success).toBe(false);
  });
});
