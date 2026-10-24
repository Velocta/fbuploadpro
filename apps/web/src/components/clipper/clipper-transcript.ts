/**
 * Clipper transcript parsing — pure functions over shell-produced text.
 * - whisper.cpp `--output-json` → validated TranscriptSegments.
 * - ffmpeg `astats` + `ametadata=print` stderr → per-second RMS series.
 * Neither function touches the bridge; the adapter feeds them text.
 */
import { TranscriptSegmentSchema, type TranscriptSegment } from '@fbuploadpro/contracts';

/** "00:01:23,456" or "00:01:23.456" → seconds. Throws on bad shape. */
export function parseWhisperTimestamp(value: unknown): number {
  if (typeof value !== 'string') throw new Error('Invalid whisper timestamp.');
  const match = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid whisper timestamp: ${value}`);
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function toSegment(value: unknown): TranscriptSegment {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid transcript segment.');
  const obj = value as Record<string, unknown>;
  // whisper.cpp shape: { timestamps: { from, to }, text }
  if (obj.timestamps && typeof obj.timestamps === 'object') {
    const ts = obj.timestamps as Record<string, unknown>;
    const parsed = TranscriptSegmentSchema.safeParse({
      startSeconds: parseWhisperTimestamp(ts.from),
      endSeconds: parseWhisperTimestamp(ts.to),
      text: obj.text,
    });
    if (!parsed.success) throw new Error('Invalid transcript segment.');
    return parsed.data;
  }
  // Plain shapes: { startSeconds, endSeconds, text } or { start, end, text }.
  const parsed = TranscriptSegmentSchema.safeParse({
    startSeconds: obj.startSeconds ?? obj.start,
    endSeconds: obj.endSeconds ?? obj.end,
    text: obj.text,
  });
  if (!parsed.success) throw new Error('Invalid transcript segment.');
  return parsed.data;
}

/**
 * Parse whisper.cpp JSON output. Accepts the `--output-json` document
 * (`{ transcription: [...] }`) and plain segment arrays. Returns segments
 * in file order. Throws (never returns partial data) on any bad shape.
 */
export function parseWhisperJson(value: unknown): TranscriptSegment[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      throw new Error('The transcription output could not be read.');
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const doc = raw as Record<string, unknown>;
    if (Array.isArray(doc.transcription)) raw = doc.transcription;
    else if (Array.isArray(doc.segments)) raw = doc.segments;
    else throw new Error('The transcription output has an unexpected shape.');
  }
  if (!Array.isArray(raw)) throw new Error('The transcription output has an unexpected shape.');
  return raw.map(toSegment);
}

/**
 * Parse ffmpeg astats stderr (with `ametadata=print`) into a dense
 * per-second RMS series in dB (index = second). Frames carry a pts_time
 * line followed by an RMS_level line; seconds with no frames are filled
 * with the series mean (or -60 dB when the series is empty) so the scorer
 * always sees a dense array. Lines in either `key: value` or `key=value`
 * form are accepted.
 */
export function parseAstatsStderr(stderrText: string): number[] {
  const bySecond = new Map<number, number[]>();
  let currentSecond: number | null = null;
  for (const line of stderrText.split('\n')) {
    const pts = /pts_time\s*[:=]\s*(\d+(?:\.\d+)?)/.exec(line);
    if (pts) {
      currentSecond = Math.floor(Number(pts[1]));
      continue;
    }
    const rms = /RMS_level\s*[:=]\s*(-?\d+(?:\.\d+)?)/.exec(line);
    if (rms && currentSecond !== null) {
      const bucket = bySecond.get(currentSecond) ?? [];
      bucket.push(Number(rms[1]));
      bySecond.set(currentSecond, bucket);
    }
  }
  if (bySecond.size === 0) return [];
  const maxSecond = Math.max(...bySecond.keys());
  const present: number[] = [];
  for (const values of bySecond.values()) {
    present.push(values.reduce((a, b) => a + b, 0) / values.length);
  }
  const fill = present.reduce((a, b) => a + b, 0) / present.length;
  const series: number[] = [];
  for (let s = 0; s <= maxSecond; s += 1) {
    const values = bySecond.get(s);
    series.push(values ? values.reduce((a, b) => a + b, 0) / values.length : fill);
  }
  return series;
}
