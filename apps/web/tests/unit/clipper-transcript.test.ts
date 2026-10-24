/**
 * Spec 148 transcript parsing tests — whisper.cpp JSON shapes and the
 * ffmpeg astats stderr format, both with synthetic inputs.
 */
import { describe, expect, it } from 'vitest';
import { parseAstatsStderr, parseWhisperJson, parseWhisperTimestamp } from '@/components/clipper/clipper-transcript';

describe('parseWhisperTimestamp', () => {
  it('parses comma and dot separators', () => {
    expect(parseWhisperTimestamp('00:01:23,456')).toBeCloseTo(83.456);
    expect(parseWhisperTimestamp('01:00:00.000')).toBe(3600);
  });
  it('throws on bad shapes', () => {
    expect(() => parseWhisperTimestamp('not a time')).toThrow();
    expect(() => parseWhisperTimestamp(42)).toThrow();
  });
});

describe('parseWhisperJson', () => {
  it('parses the whisper.cpp --output-json document', () => {
    const doc = JSON.stringify({
      transcription: [
        { timestamps: { from: '00:00:00,000', to: '00:00:03,500' }, text: ' Hello there.' },
        { timestamps: { from: '00:00:03,500', to: '00:00:07,000' }, text: ' How are you?' },
      ],
    });
    const segments = parseWhisperJson(doc);
    expect(segments).toEqual([
      { startSeconds: 0, endSeconds: 3.5, text: 'Hello there.' },
      { startSeconds: 3.5, endSeconds: 7, text: 'How are you?' },
    ]);
  });
  it('parses a plain segment array', () => {
    const segments = parseWhisperJson([{ startSeconds: 0, endSeconds: 2, text: 'Hi.' }]);
    expect(segments).toHaveLength(1);
  });
  it('throws on bad shapes instead of returning partial data', () => {
    expect(() => parseWhisperJson({ nope: true })).toThrow();
    expect(() => parseWhisperJson('not json')).toThrow();
    expect(() =>
      parseWhisperJson([{ timestamps: { from: '00:00:05,000', to: '00:00:02,000' }, text: 'Backwards.' }]),
    ).toThrow();
  });
});

describe('parseAstatsStderr', () => {
  it('buckets RMS levels per second from ametadata print output', () => {
    const stderr = [
      'frame:0 pts:0 pts_time:0',
      'lavfi.astats.Overall.RMS_level: -30.0',
      'frame:1 pts:16000 pts_time:1',
      'lavfi.astats.Overall.RMS_level: -10.0',
      'frame:2 pts:32000 pts_time:1',
      'lavfi.astats.Overall.RMS_level: -12.0',
      'frame:3 pts:48000 pts_time:2',
      'lavfi.astats.Overall.RMS_level: -25.0',
    ].join('\n');
    const series = parseAstatsStderr(stderr);
    expect(series[0]).toBeCloseTo(-30);
    expect(series[1]).toBeCloseTo(-11);
    expect(series[2]).toBeCloseTo(-25);
  });
  it('accepts key=value form and fills gaps with the series mean', () => {
    const stderr = [
      'frame:0 pts_time:0',
      'lavfi.astats.Overall.RMS_level=-20.0',
      'frame:1 pts_time:2',
      'lavfi.astats.Overall.RMS_level=-30.0',
    ].join('\n');
    const series = parseAstatsStderr(stderr);
    expect(series).toHaveLength(3);
    expect(series[1]).toBeCloseTo(-25);
  });
  it('returns an empty series when no RMS lines exist', () => {
    expect(parseAstatsStderr('ffmpeg version 7\nInput #0')).toEqual([]);
  });
});
