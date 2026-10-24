/**
 * Spec 148 caption tests — SRT timestamps, ASS 2-line split, slug +
 * collision-free filenames. ASS and SRT derive from the same segments.
 */
import { describe, expect, it } from 'vitest';
import {
  clipFileName,
  clipSrtFileName,
  clipThumbFileName,
  formatAssTimestamp,
  formatSrtTimestamp,
  segmentsToAss,
  segmentsToSrt,
  slugifyExcerpt,
  splitCaptionLines,
} from '@/components/clipper/clipper-captions';
import type { TranscriptSegment } from '@fbuploadpro/contracts';

const SEGMENTS: TranscriptSegment[] = [
  { startSeconds: 10, endSeconds: 14, text: 'Hello and welcome back to the show.' },
  { startSeconds: 14, endSeconds: 20, text: 'Today we ask the big question everyone avoids.' },
];

describe('slug + filenames', () => {
  it('slugifies excerpts and falls back to clip', () => {
    expect(slugifyExcerpt('Why Does This Happen?! (Every Time)')).toBe('why-does-this-happen-every-time');
    expect(slugifyExcerpt('!!!')).toBe('clip');
    expect(slugifyExcerpt('a'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
  it('builds collision-free names from the clip index', () => {
    expect(clipFileName(1, 'Same excerpt here')).toBe('clip-01-same-excerpt-here.mp4');
    expect(clipFileName(2, 'Same excerpt here')).toBe('clip-02-same-excerpt-here.mp4');
    expect(clipSrtFileName(1, 'Same excerpt here')).toBe('clip-01-same-excerpt-here.srt');
    expect(clipThumbFileName(1)).toBe('clip-01-thumb.jpg');
  });
});

describe('SRT', () => {
  it('formats timestamps', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(61.5)).toBe('00:01:01,500');
    expect(formatSrtTimestamp(3723.456)).toBe('01:02:03,456');
  });
  it('renders clip-relative events', () => {
    const srt = segmentsToSrt(SEGMENTS, 10, 20);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:04,000\nHello and welcome back to the show.');
    expect(srt).toContain('2\n00:00:04,000 --> 00:00:10,000\nToday we ask the big question everyone avoids.');
  });
  it('clips segments to the clip window', () => {
    const srt = segmentsToSrt(SEGMENTS, 12, 20);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,000\nHello and welcome back to the show.');
    expect(srt).not.toContain('00:00:04,000');
  });
});

describe('ASS', () => {
  it('formats timestamps', () => {
    expect(formatAssTimestamp(61.5)).toBe('0:01:01.50');
    expect(formatAssTimestamp(3723.45)).toBe('1:02:03.45');
  });
  it('splits long captions into at most 2 lines', () => {
    expect(splitCaptionLines('Short line.')).toEqual(['Short line.']);
    const lines = splitCaptionLines('This is a much longer caption that must be split across two balanced lines for readability.');
    expect(lines.length).toBe(2);
    expect(lines.join(' ')).toBe('This is a much longer caption that must be split across two balanced lines for readability.');
  });
  it('renders a fixed-style ASS document with \\N line joins', () => {
    const ass = segmentsToAss(SEGMENTS, 10, 20, 1080, 1920);
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('Style: Clipper,Arial,48,&H00FFFFFF');
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:04.00,Clipper,,0,0,0,,Hello and welcome back to the show.');
    expect(ass).toContain('Alignment, MarginL, MarginR, MarginV');
  });
  it('strips ASS control braces from caption text', () => {
    const ass = segmentsToAss([{ startSeconds: 0, endSeconds: 5, text: 'Hello {bold}world' }], 0, 5);
    expect(ass).not.toContain('{bold}');
    expect(ass).toContain('Hello boldworld');
  });
});
