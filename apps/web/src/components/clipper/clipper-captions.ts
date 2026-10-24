/**
 * Clipper caption + filename generation (spec 148, OD-148-4) — the SINGLE
 * implementation of ASS/SRT generation. Both files derive from the same
 * segment data, so they cannot diverge. Caption style is fixed in v1
 * (no picker): segment-level captions, bottom-centre, white text with
 * black outline, readable at phone width. Word-level karaoke is deferred
 * (148-F3) and is never claimed here.
 */
import type { TranscriptSegment } from '@fbuploadpro/contracts';

/** URL/filename-safe slug from a clip excerpt (max 40 chars). */
export function slugifyExcerpt(excerpt: string): string {
  const slug = excerpt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'clip';
}

/** `clip-01-<slug>.mp4` — the clip index is already in the name, so names never collide. */
export function clipFileName(index: number, excerpt: string): string {
  return `clip-${String(index).padStart(2, '0')}-${slugifyExcerpt(excerpt)}.mp4`;
}

export function clipSrtFileName(index: number, excerpt: string): string {
  return clipFileName(index, excerpt).replace(/\.mp4$/, '.srt');
}

export function clipThumbFileName(index: number): string {
  return `clip-${String(index).padStart(2, '0')}-thumb.jpg`;
}

/** SRT timestamp: HH:MM:SS,mmm */
export function formatSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  if (millis === 1000) return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds + 1)},000`;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`;
}

/** ASS timestamp: H:MM:SS.cc */
export function formatAssTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const centis = Math.round((clamped - Math.floor(clamped)) * 100);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (centis === 100) return `${hours}:${pad2(minutes)}:${pad2(seconds + 1)}.00`;
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
}

interface ClipRelativeSegment {
  start: number;
  end: number;
  text: string;
}

/** Segments clipped to the clip window, relative to the clip start. */
export function clipRelativeSegments(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
): ClipRelativeSegment[] {
  const out: ClipRelativeSegment[] = [];
  for (const seg of segments) {
    const start = Math.max(0, seg.startSeconds - clipStart);
    const end = Math.min(clipEnd - clipStart, seg.endSeconds - clipStart);
    if (end > start && seg.text.trim().length > 0) {
      out.push({ start, end, text: seg.text.trim() });
    }
  }
  return out;
}

/** Sidecar SRT for one clip, from the clip's segments. */
export function segmentsToSrt(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
): string {
  const rel = clipRelativeSegments(segments, clipStart, clipEnd);
  const blocks = rel.map(
    (s, i) => `${i + 1}\n${formatSrtTimestamp(s.start)} --> ${formatSrtTimestamp(s.end)}\n${s.text}`,
  );
  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

/**
 * Split caption text into at most 2 lines: one line when short, otherwise
 * split at the space nearest the middle so both lines stay balanced.
 */
export function splitCaptionLines(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 42) return [clean];
  const middle = Math.floor(clean.length / 2);
  let split = -1;
  for (let d = 0; d <= middle; d += 1) {
    if (clean[middle + d] === ' ') {
      split = middle + d;
      break;
    }
    if (clean[middle - d] === ' ') {
      split = middle - d;
      break;
    }
  }
  if (split <= 0) return [clean];
  return [clean.slice(0, split).trim(), clean.slice(split).trim()].filter(Boolean);
}

const ASS_HEADER = (width: number, height: number): string =>
  '[Script Info]\n' +
  'ScriptType: v4.00+\n' +
  `PlayResX: ${width}\n` +
  `PlayResY: ${height}\n` +
  'ScaledBorderAndShadow: yes\n' +
  '\n' +
  '[V4+ Styles]\n' +
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
  'Style: Clipper,Arial,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,60,60,120,1\n' +
  '\n' +
  '[Events]\n' +
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';

/** Burn-in ASS for one clip (same segments as the SRT). Text is sanitised so ASS control braces cannot leak through. */
export function segmentsToAss(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  width = 1080,
  height = 1920,
): string {
  const rel = clipRelativeSegments(segments, clipStart, clipEnd);
  const events = rel.map((s) => {
    const text = splitCaptionLines(s.text.replace(/[{}]/g, '')).join('\\N');
    return `Dialogue: 0,${formatAssTimestamp(s.start)},${formatAssTimestamp(s.end)},Clipper,,0,0,0,,${text}`;
  });
  return `${ASS_HEADER(width, height)}${events.join('\n')}${events.length > 0 ? '\n' : ''}`;
}
