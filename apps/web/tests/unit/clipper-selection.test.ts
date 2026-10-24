/**
 * Spec 148 scorer tests — synthetic segments with known questions, energy
 * peaks, topic shifts, and punchline shapes. Determinism, boundary
 * snapping, non-overlap, count cap, and the quality floor are asserted
 * directly (plan §3).
 */
import { describe, expect, it } from 'vitest';
import { selectClips } from '@/components/clipper/clipper-selection';
import type { TranscriptSegment } from '@fbuploadpro/contracts';

function seg(start: number, end: number, text: string): TranscriptSegment {
  return { startSeconds: start, endSeconds: end, text };
}

const LONG_NEUTRAL =
  'The team spent the whole morning reviewing the quarterly report and discussing the next steps for the project timeline in detail together today';

// Six 25 s segments: neutral, short question (punchline shape), neutral,
// 15-word question after a topic shift, neutral, neutral. Triples:
// [0,1,2] all share "team/project" words; [3,4,5] share "rocket/orbit"
// words, so the Jaccard between triples drops below 0.25 and segment 3
// starts a new topic.
const SEGMENTS: TranscriptSegment[] = [
  seg(0, 25, `${LONG_NEUTRAL} team project`),
  seg(25, 50, 'What happened next? team project'),
  seg(50, 75, `${LONG_NEUTRAL} team project`),
  // Short question after a long setup (punchline shape) at a topic boundary:
  // question 30 + punchline 25 + strong-opening 20 = 75, so it still clears
  // the 40 floor after the 15-point diversity penalty from the first clip.
  seg(75, 100, 'Why did the rocket orbit shift today? rocket orbit'),
  seg(100, 125, 'The rocket orbit plan changed again this week rocket orbit'),
  seg(125, 150, 'Engineers checked the rocket orbit schedule twice rocket orbit'),
];

describe('selectClips', () => {
  it('picks question + punchline clips with reasons', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 5 });
    expect(clips.length).toBeGreaterThanOrEqual(2);
    const first = clips.find((c) => c.startSeconds === 25);
    expect(first).toBeDefined();
    expect(first?.reasons).toContain('question');
    expect(first?.reasons).toContain('punchline');
  });

  it('marks the topic-change segment', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 5 });
    const topic = clips.find((c) => c.startSeconds === 75);
    expect(topic).toBeDefined();
    expect(topic?.reasons).toContain('topic-change');
    expect(topic?.reasons).toContain('question');
  });

  it('awards high-energy from a loud energy series', () => {
    const energy = Array.from({ length: 150 }, (_, s) => (s >= 25 && s < 50 ? -5 : -30));
    const clips = selectClips(SEGMENTS, { clipCount: 5, energySeries: energy });
    const loud = clips.find((c) => c.startSeconds === 25);
    expect(loud?.reasons).toContain('high-energy');
  });

  it('is deterministic: same input gives identical output twice', () => {
    const a = selectClips(SEGMENTS, { clipCount: 5 });
    const b = selectClips(SEGMENTS, { clipCount: 5 });
    expect(a).toEqual(b);
  });

  it('snaps every clip to segment boundaries', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 5 });
    const starts = new Set(SEGMENTS.map((s) => s.startSeconds));
    const ends = new Set(SEGMENTS.map((s) => s.endSeconds));
    for (const clip of clips) {
      expect(starts.has(clip.startSeconds)).toBe(true);
      expect(ends.has(clip.endSeconds)).toBe(true);
      expect(clip.durationSeconds).toBeGreaterThanOrEqual(15);
      expect(clip.durationSeconds).toBeLessThanOrEqual(90);
      expect(clip.reasons.length).toBeGreaterThanOrEqual(1);
      expect(clip.excerpt.length).toBeGreaterThan(0);
    }
  });

  it('never returns overlapping clips', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 5 });
    const sorted = [...clips].sort((x, y) => x.startSeconds - y.startSeconds);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].startSeconds).toBeGreaterThanOrEqual(sorted[i - 1].endSeconds);
    }
  });

  it('respects the count cap', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 1 });
    expect(clips.length).toBe(1);
  });

  it('returns fewer than asked when only some windows clear the floor (never filler)', () => {
    const clips = selectClips(SEGMENTS, { clipCount: 5 });
    // Only the two reason-bearing windows clear the floor; neutrals score 0.
    expect(clips.length).toBe(2);
  });

  it('returns an empty selection for an empty transcript', () => {
    expect(selectClips([], { clipCount: 5 })).toEqual([]);
  });

  it('awards strong-opening to a boundary-start question that is not a punchline', () => {
    const segments: TranscriptSegment[] = [
      seg(0, 25, 'Brief notes team project'),
      seg(25, 50, 'Short update team project'),
      seg(50, 75, 'Quick summary team project'),
      seg(75, 100, 'Why did the rocket launch window move to a later orbit slot today then rocket orbit'),
      seg(100, 125, 'The rocket orbit plan changed again this week rocket orbit'),
      seg(125, 150, 'Engineers checked the rocket orbit schedule twice rocket orbit'),
    ];
    const clips = selectClips(segments, { clipCount: 5 });
    const opening = clips.find((c) => c.startSeconds === 75);
    expect(opening).toBeDefined();
    expect(opening?.reasons).toContain('strong-opening');
    expect(opening?.reasons).toContain('topic-change');
  });
});
