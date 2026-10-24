import { describe, expect, it } from 'vitest';
import { formatDuration, humanizeBytes, nextAvailableName, parseResolutionString, sanitizeFileName, splitStemExt } from './filenames';

describe('sanitizeFileName', () => {
  it('replaces path separators and unsafe characters', () => {
    expect(sanitizeFileName('My Video: Part 1/2?')).toBe('My Video_ Part 1_2_');
  });
  it('strips leading dots (dotfiles never escape as hidden files)', () => {
    expect(sanitizeFileName('...hidden')).toBe('hidden');
  });
  it('falls back when nothing survives sanitisation', () => {
    expect(sanitizeFileName('...')).toMatch(/^download_\d+$/);
    expect(sanitizeFileName('')).toMatch(/^download_\d+$/);
  });
  it('keeps ordinary titles untouched', () => {
    expect(sanitizeFileName('Chai Time Friday')).toBe('Chai Time Friday');
  });
});

describe('nextAvailableName', () => {
  it('returns the desired name when free', () => {
    expect(nextAvailableName(new Set(['a.mp4']), 'b.mp4')).toBe('b.mp4');
  });
  it('appends (2), (3)… before the extension', () => {
    const existing = new Set(['clip.mp4', 'clip (2).mp4']);
    expect(nextAvailableName(existing, 'clip.mp4')).toBe('clip (3).mp4');
  });
  it('handles extensionless names', () => {
    expect(nextAvailableName(new Set(['clip']), 'clip')).toBe('clip (2)');
  });
});

describe('splitStemExt', () => {
  it('splits on the last dot; dotfiles have no extension', () => {
    expect(splitStemExt('clip.final.mp4')).toEqual({ stem: 'clip.final', ext: 'mp4' });
    expect(splitStemExt('.hidden')).toEqual({ stem: '.hidden', ext: '' });
    expect(splitStemExt('noext')).toEqual({ stem: 'noext', ext: '' });
  });
});

describe('humanizeBytes / formatDuration', () => {
  it('humanises sizes', () => {
    expect(humanizeBytes(500)).toBe('500 B');
    expect(humanizeBytes(1536)).toBe('1.5 KB');
    expect(humanizeBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('never renders a fake 0:00 for unknown durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(125)).toBe('2:05');
  });
});

describe('parseResolutionString', () => {
  it('parses WxH and rejects audio-only / garbage', () => {
    expect(parseResolutionString('1280x720')).toEqual({ width: 1280, height: 720 });
    expect(parseResolutionString('audio only')).toEqual({ width: null, height: null });
    expect(parseResolutionString(null)).toEqual({ width: null, height: null });
    expect(parseResolutionString('1080p')).toEqual({ width: null, height: null });
  });
});
