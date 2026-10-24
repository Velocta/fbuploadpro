/**
 * Clipper selection scorer (spec 148, plan §3) — pure function, no React,
 * no bridge, no randomness, no wall-clock. Same transcript → same clips.
 *
 * Signals (nothing else is claimed):
 * - question (+30): segment ends with `?` or starts with an interrogative.
 * - energy (+0–30): segment mean RMS vs. the job median RMS, clamped.
 *   `high-energy` reason when the energy contribution is >= 15.
 * - punchline (+25): <= 12 words following a >= 25-word segment.
 * - topic-change: content-word Jaccard between adjacent 3-segment windows
 *   < 0.25 marks a boundary; the first segment after it carries the reason.
 * - strong-opening (+20, compound only): a boundary-start segment that also
 *   scores on question or energy.
 * Windows are segment unions (never mid-word), 15–90 s, non-overlapping,
 * with a quality floor (window mean segment score >= 40) and a diversity
 * penalty (segments within 30 s of a picked clip lose 15 points).
 */
import type { ClipReason, ClipSelection, TranscriptSegment } from '@fbuploadpro/contracts';
import { CLIP_LIMITS } from '@fbuploadpro/contracts';

export const CLIP_REASON_ORDER: ClipReason[] = [
  'question',
  'high-energy',
  'punchline',
  'topic-change',
  'strong-opening',
];

const INTERROGATIVES = new Set(['what', 'why', 'how', 'when', 'where', 'who', 'which']);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'of', 'to', 'in', 'on',
  'for', 'with', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'my', 'your', 'his', 'her', 'our', 'their', 'am', 'do', 'does', 'did',
  'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'not', 'no',
  'yes', 'just', 'like', 'really', 'very', 'much', 'more', 'most', 'all', 'any',
  'some', 'one', 'two', 'get', 'got', 'go', 'going', 'know', 'think', 'well',
]);

export interface SelectClipsOptions {
  clipCount: number;
  minSeconds?: number;
  maxSeconds?: number;
  /** Per-second RMS levels in dB (index = second). Omit when unavailable. */
  energySeries?: number[] | undefined;
}

interface ScoredSegment {
  index: number;
  segment: TranscriptSegment;
  score: number;
  reasons: ClipReason[];
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function contentWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function segmentMeanRms(segment: TranscriptSegment, energySeries: number[]): number | null {
  const from = Math.floor(segment.startSeconds);
  const to = Math.min(energySeries.length - 1, Math.floor(segment.endSeconds));
  if (from > to || energySeries.length === 0) return null;
  let sum = 0;
  let count = 0;
  for (let s = from; s <= to; s += 1) {
    const v = energySeries[s];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

function scoreSegments(
  segments: TranscriptSegment[],
  energySeries: number[] | undefined,
): ScoredSegment[] {
  // Topic boundaries: adjacent non-overlapping 3-segment windows whose
  // content-word Jaccard drops below 0.25. The first segment of the second
  // window starts the new topic.
  const boundaryStarts = new Set<number>();
  for (let k = 0; k + 5 < segments.length; k += 3) {
    const a = new Set<string>();
    const b = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      for (const w of contentWords(segments[k + i].text)) a.add(w);
      for (const w of contentWords(segments[k + 3 + i].text)) b.add(w);
    }
    if (jaccard(a, b) < 0.25) boundaryStarts.add(k + 3);
  }

  const jobMedian = energySeries && energySeries.length > 0 ? median(energySeries) : null;
  return segments.map((segment, index) => {
    let score = 0;
    const reasons: ClipReason[] = [];
    const text = segment.text.trim();
    const firstWord = text.toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
    const isQuestion = text.endsWith('?') || INTERROGATIVES.has(firstWord);
    if (isQuestion) {
      score += 30;
      reasons.push('question');
    }
    let energyScore = 0;
    if (energySeries && jobMedian !== null) {
      const mean = segmentMeanRms(segment, energySeries);
      if (mean !== null) {
        energyScore = Math.max(0, Math.min(1, (mean - jobMedian) / 20)) * 30;
        score += energyScore;
        if (energyScore >= 15) reasons.push('high-energy');
      }
    }
    if (index > 0 && wordCount(text) <= 12 && wordCount(segments[index - 1].text) >= 25) {
      score += 25;
      reasons.push('punchline');
    }
    const isBoundaryStart = boundaryStarts.has(index);
    if (isBoundaryStart) reasons.push('topic-change');
    if (isBoundaryStart && (isQuestion || energyScore >= 15)) {
      score += 20;
      reasons.push('strong-opening');
    }
    return { index, segment, score, reasons };
  });
}

interface Window {
  lo: number;
  hi: number;
  startSeconds: number;
  endSeconds: number;
  total: number;
  mean: number;
  reasons: ClipReason[];
  excerpt: string;
  rebuilt: boolean;
}

function buildWindow(scored: ScoredSegment[], seedIndex: number, maxSeconds: number): Window | null {
  let lo = seedIndex;
  let hi = seedIndex;
  const duration = () => scored[hi].segment.endSeconds - scored[lo].segment.startSeconds;
  // Grow around the seed (setup context first, then forward) until >= 20 s,
  // never past maxSeconds, never mid-segment (windows are segment unions).
  while (duration() < 20) {
    const prevDuration =
      lo > 0 ? scored[hi].segment.endSeconds - scored[lo - 1].segment.startSeconds : null;
    const nextDuration =
      hi + 1 < scored.length ? scored[hi + 1].segment.endSeconds - scored[lo].segment.startSeconds : null;
    if (prevDuration !== null && prevDuration <= maxSeconds) {
      lo -= 1;
    } else if (nextDuration !== null && nextDuration <= maxSeconds) {
      hi += 1;
    } else {
      break;
    }
  }
  const startSeconds = scored[lo].segment.startSeconds;
  const endSeconds = scored[hi].segment.endSeconds;
  const total = scored.slice(lo, hi + 1).reduce((sum, s) => sum + s.score, 0);
  const mean = total / (hi - lo + 1);
  const reasonSet = new Set<ClipReason>();
  for (let i = lo; i <= hi; i += 1) {
    for (const r of scored[i].reasons) reasonSet.add(r);
  }
  const reasons = CLIP_REASON_ORDER.filter((r) => reasonSet.has(r)).slice(0, 3);
  const joined = scored
    .slice(lo, hi + 1)
    .map((s) => s.segment.text.trim())
    .join(' ');
  let excerpt = joined;
  if (excerpt.length > 500) {
    const cut = excerpt.lastIndexOf(' ', 497);
    excerpt = `${excerpt.slice(0, cut > 0 ? cut : 497)}…`;
  }
  return { lo, hi, startSeconds, endSeconds, total, mean, reasons, excerpt, rebuilt: false };
}

function overlaps(a: Window, b: Window): boolean {
  return a.startSeconds < b.endSeconds && b.startSeconds < a.endSeconds;
}

function withinDiversityRange(window: Window, picked: Window[]): boolean {
  return picked.some(
    (p) => window.startSeconds < p.endSeconds + 30 && p.startSeconds < window.endSeconds + 30,
  );
}

/**
 * Deterministic clip selection. Returns at most `clipCount` clips, fewer
 * when fewer windows clear the quality floor — never filler clips.
 */
export function selectClips(
  segments: TranscriptSegment[],
  options: SelectClipsOptions,
): ClipSelection[] {
  const minSeconds = options.minSeconds ?? CLIP_LIMITS.MIN_CLIP_SECONDS;
  const maxSeconds = options.maxSeconds ?? CLIP_LIMITS.MAX_CLIP_SECONDS;
  const clean = segments
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0 && s.endSeconds > s.startSeconds);
  if (clean.length === 0) return [];
  const base = scoreSegments(clean, options.energySeries);

  // One candidate window per seed segment, deduplicated by range.
  const seen = new Set<string>();
  const candidates: Window[] = [];
  for (let i = 0; i < base.length; i += 1) {
    const w = buildWindow(base, i, maxSeconds);
    if (!w) continue;
    const key = `${w.lo}-${w.hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(w);
  }

  const picked: Window[] = [];
  const pool = [...candidates];
  while (picked.length < options.clipCount && pool.length > 0) {
    // Diversity penalty: segments within 30 s of a picked clip lose 15 points.
    const rescored = pool.map((w) => {
      let total = w.total;
      let mean = w.mean;
      if (picked.length > 0 && withinDiversityRange(w, picked)) {
        const penalised = base
          .slice(w.lo, w.hi + 1)
          .reduce((sum, s) => {
            const near = picked.some(
              (p) => s.segment.startSeconds < p.endSeconds + 30 && p.startSeconds < s.segment.endSeconds + 30,
            );
            return sum + Math.max(0, s.score - (near ? 15 : 0));
          }, 0);
        total = penalised;
        mean = penalised / (w.hi - w.lo + 1);
      }
      return { w, total, mean };
    });
    rescored.sort((x, y) => y.total - x.total || x.w.startSeconds - y.w.startSeconds);
    let progressed = false;
    for (const entry of rescored) {
      const { w, total, mean } = entry;
      const duration = w.endSeconds - w.startSeconds;
      if (duration < minSeconds || duration > maxSeconds || mean < 40 || w.reasons.length === 0) {
        continue;
      }
      const blocker = picked.find((p) => overlaps(w, p));
      if (!blocker) {
        picked.push({ ...w, total, mean });
        pool.splice(pool.indexOf(w), 1);
        progressed = true;
        break;
      }
      // Rebuild once around the loser: keep the longer non-overlapping run,
        // scored exactly over that run (no expansion back into the blocker).
      if (!w.rebuilt) {
        const runs: { lo: number; hi: number }[] = [];
        let runStart: number | null = null;
        for (let i = w.lo; i <= w.hi; i += 1) {
          const seg = base[i].segment;
          const insideBlocker = seg.startSeconds < blocker.endSeconds && blocker.startSeconds < seg.endSeconds;
          if (!insideBlocker && runStart === null) runStart = i;
          if ((insideBlocker || i === w.hi) && runStart !== null) {
            runs.push({ lo: runStart, hi: insideBlocker ? i - 1 : i });
            runStart = null;
          }
        }
        runs.sort(
          (x, y) =>
            base[y.hi].segment.endSeconds - base[y.lo].segment.startSeconds -
            (base[x.hi].segment.endSeconds - base[x.lo].segment.startSeconds),
        );
        const best = runs[0];
        if (best) {
          const total = base.slice(best.lo, best.hi + 1).reduce((sum, s) => sum + s.score, 0);
          const mean = total / (best.hi - best.lo + 1);
          const reasonSet = new Set<ClipReason>();
          for (let i = best.lo; i <= best.hi; i += 1) {
            for (const r of base[i].reasons) reasonSet.add(r);
          }
          const reasons = CLIP_REASON_ORDER.filter((r) => reasonSet.has(r)).slice(0, 3);
          const runJoined = base
            .slice(best.lo, best.hi + 1)
            .map((s) => s.segment.text.trim())
            .join(' ');
          const runExcerpt =
            runJoined.length > 500
              ? `${runJoined.slice(0, runJoined.lastIndexOf(' ', 497) > 0 ? runJoined.lastIndexOf(' ', 497) : 497)}…`
              : runJoined;
          const rebuilt: Window = {
            lo: best.lo,
            hi: best.hi,
            startSeconds: base[best.lo].segment.startSeconds,
            endSeconds: base[best.hi].segment.endSeconds,
            total,
            mean,
            reasons,
            excerpt: runExcerpt,
            rebuilt: true,
          };
          const rDuration = rebuilt.endSeconds - rebuilt.startSeconds;
          if (rDuration >= minSeconds && rDuration <= maxSeconds && mean >= 40 && reasons.length > 0) {
            pool.splice(pool.indexOf(w), 1, rebuilt);
            progressed = true;
            break;
          }
        }
        // Unrebuildable loser: drop it so the loop terminates.
        pool.splice(pool.indexOf(w), 1);
        progressed = true;
        break;
      }
      pool.splice(pool.indexOf(w), 1);
      progressed = true;
      break;
    }
    if (!progressed) break;
  }

  picked.sort((a, b) => a.startSeconds - b.startSeconds);
  return picked.map((w, i) => ({
    id: `clip-${String(i + 1).padStart(2, '0')}`,
    startSeconds: w.startSeconds,
    endSeconds: w.endSeconds,
    durationSeconds: w.endSeconds - w.startSeconds,
    excerpt: w.excerpt,
    reasons: w.reasons,
    score: Math.round(w.total * 10) / 10,
    aiRanked: false,
    exportStatus: 'pending' as const,
  }));
}
