import { describe, expect, it } from 'vitest';
import {
  DownloadChoiceSchema,
  DownloadJobSchema,
  FormatListingSchema,
  ProgressEventSchema,
  VIDEO_SUITE_ERROR_MESSAGES,
  VideoFormatSchema,
  VideoSuiteErrorCodeEnum,
  isValidFormatSelector,
  libraryImportEligibility,
  pickBestFormatAtOrBelowCap,
  presetToFormatSelector,
  type VideoFormat,
} from '../src/domain/video-suite.js';

function format(overrides: Partial<VideoFormat>): VideoFormat {
  return {
    formatId: '137',
    ext: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    vcodec: 'avc1',
    acodec: 'mp4a',
    filesizeApprox: 1000,
    formatNote: '1080p',
    isVideoOnly: false,
    isAudioOnly: false,
    ...overrides,
  };
}

describe('video-suite error taxonomy', () => {
  it('every code has a plain-language message and no message leaks tool output', () => {
    for (const code of VideoSuiteErrorCodeEnum.options) {
      const message = VIDEO_SUITE_ERROR_MESSAGES[code];
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain('stderr');
      expect(message).not.toContain('ffmpeg');
      expect(message).not.toContain('yt-dlp');
    }
  });
  it('cancelled is not styled as an error: it has its own message', () => {
    expect(VIDEO_SUITE_ERROR_MESSAGES.cancelled).toBe('Cancelled.');
  });
});

describe('preset selectors (frozen charset: no * or /)', () => {
  it.each([
    ['best', 'bestvideo+bestaudio'],
    ['best_1080', 'bestvideo[height<=1080]+bestaudio'],
    ['best_720', 'bestvideo[height<=720]+bestaudio'],
    ['best_480', 'bestvideo[height<=480]+bestaudio'],
    ['audio_only', 'bestaudio'],
  ] as const)('%s maps to %s and passes the frozen charset', (preset, expected) => {
    expect(presetToFormatSelector(preset)).toBe(expected);
    expect(isValidFormatSelector(expected)).toBe(true);
  });
  it('rejects the classic wildcard spellings the frozen contract forbids', () => {
    expect(isValidFormatSelector('bv*+ba/b')).toBe(false);
    expect(isValidFormatSelector('bv[height<=720]+ba/b')).toBe(false);
    expect(isValidFormatSelector('')).toBe(false);
  });
});

describe('cap selection', () => {
  const listing = [
    format({ formatId: '1080', height: 1080 }),
    format({ formatId: '720', height: 720, filesizeApprox: 500 }),
    format({ formatId: '720b', height: 720, filesizeApprox: 900 }),
    format({ formatId: '480', height: 480 }),
    format({ formatId: 'audio', height: null, isAudioOnly: true, isVideoOnly: false }),
  ];
  it('never picks above the cap', () => {
    expect(pickBestFormatAtOrBelowCap(listing, 720)?.formatId).toBe('720b');
  });
  it('falls back below the cap instead of failing', () => {
    expect(pickBestFormatAtOrBelowCap(listing, 480)?.formatId).toBe('480');
  });
  it('returns null when nothing satisfies the cap', () => {
    expect(pickBestFormatAtOrBelowCap(listing, 240)).toBeNull();
  });
  it('ignores audio-only formats', () => {
    expect(pickBestFormatAtOrBelowCap([format({ formatId: 'a', height: null, isAudioOnly: true })], 1080)).toBeNull();
  });
});

describe('schema validation', () => {
  it('accepts a valid download job and rejects a corrupt record', () => {
    const job = {
      id: '11111111-1111-4111-8111-111111111111',
      url: 'https://example.com/watch?v=1',
      title: 'Test',
      choice: { kind: 'preset', preset: 'best_720' },
      destinationFolder: '/tmp/videos',
      fileName: 'Test.mp4',
      status: 'queued',
      progress: null,
      errorCode: null,
      errorDetail: null,
      finalPath: null,
      finalSizeBytes: null,
      note: null,
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
    };
    expect(DownloadJobSchema.safeParse(job).success).toBe(true);
    expect(DownloadJobSchema.safeParse({ ...job, status: 'fetching' }).success).toBe(false);
    expect(DownloadJobSchema.safeParse({ ...job, choice: { kind: 'preset', preset: 'best_999' } }).success).toBe(false);
  });
  it('rejects a progress event with a percent but no total (fabricated percent guard is UI-side; schema keeps both nullable)', () => {
    const base = {
      operationId: 'run-1',
      phase: 'downloading',
      bytesProcessed: 0,
      totalBytes: null,
      speedBytesPerSecond: null,
      etaSeconds: null,
      percent: 42,
      finalPath: null,
      finalSizeBytes: null,
      errorCode: null,
      errorDetail: null,
    };
    expect(ProgressEventSchema.safeParse(base).success).toBe(true);
    expect(ProgressEventSchema.safeParse({ ...base, percent: 101 }).success).toBe(false);
  });
  it('format listings validate; empty formats parse but are rejected by the client, not the schema', () => {
    expect(FormatListingSchema.safeParse({ url: 'https://example.com', title: null, durationSeconds: null, thumbnailUrl: null, formats: [] }).success).toBe(true);
    expect(VideoFormatSchema.safeParse(format({})).success).toBe(true);
  });
  it('choice union rejects unknown kinds', () => {
    expect(DownloadChoiceSchema.safeParse({ kind: 'raw', args: '-f best' }).success).toBe(false);
  });
});

describe('library import eligibility', () => {
  it('mp4/mov/webm importable', () => {
    expect(libraryImportEligibility('clip.mp4', 100)).toEqual({ eligible: true, mimeType: 'video/mp4' });
    expect(libraryImportEligibility('clip.MOV', 100)).toEqual({ eligible: true, mimeType: 'video/quicktime' });
    expect(libraryImportEligibility('clip.webm', 100)).toEqual({ eligible: true, mimeType: 'video/webm' });
  });
  it('audio disabled with explanation, never silently converted', () => {
    expect(libraryImportEligibility('song.mp3', 100)).toEqual({ eligible: false, reason: 'audio', mimeType: null });
    expect(libraryImportEligibility('song.m4a', 100)).toEqual({ eligible: false, reason: 'audio', mimeType: null });
  });
  it('other containers offer convert-first', () => {
    expect(libraryImportEligibility('clip.mkv', 100)).toEqual({ eligible: false, reason: 'convert_first', mimeType: null });
  });
  it('over 500 MB refused', () => {
    expect(libraryImportEligibility('big.mp4', 500 * 1024 * 1024 + 1)).toMatchObject({ eligible: false, reason: 'too_large' });
  });
});
