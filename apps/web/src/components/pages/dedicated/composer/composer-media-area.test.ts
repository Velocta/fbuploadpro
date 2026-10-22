import { describe, it, expect } from 'vitest';
import {
  getMediaCapNotice,
  capNoticeForFormat,
  resolveSelectionAfterAdd,
  getMediaItemError,
  type ComposerMediaItem,
} from './composer-media-area';

function makeItem(overrides: Partial<ComposerMediaItem> = {}): ComposerMediaItem {
  return {
    id: 'media-1',
    name: 'photo.png',
    mediaType: 'image',
    url: 'https://example.com/photo.png',
    ...overrides,
  };
}

describe('resolveSelectionAfterAdd — in-composer import auto-select (QA #15)', () => {
  it('selects the imported file when nothing is selected yet', () => {
    const imported = makeItem({ id: 'imported-1' });
    const result = resolveSelectionAfterAdd([], [imported], 'image');
    expect(result.blocked).toBe(false);
    expect(result.capNotice).toBeNull();
    expect(result.items).toEqual([imported]);
  });

  it('selects an imported video for Video/Reel formats', () => {
    const imported = makeItem({ id: 'imported-video', mediaType: 'video', name: 'clip.mp4' });
    expect(resolveSelectionAfterAdd([], [imported], 'video').items).toEqual([imported]);
    expect(resolveSelectionAfterAdd([], [imported], 'reel').items).toEqual([imported]);
  });

  it('never silently drops an import when a file is already selected — blocks with the cap notice', () => {
    const existing = makeItem({ id: 'existing' });
    const imported = makeItem({ id: 'imported-2' });
    const result = resolveSelectionAfterAdd([existing], [imported], 'image');
    expect(result.blocked).toBe(true);
    expect(result.items).toEqual([existing]);
    expect(result.capNotice).toBe(
      'Photo posts take 1 image. Remove the current one to pick another.'
    );
  });

  it('with several imported files, the newest one becomes the selection', () => {
    const first = makeItem({ id: 'first' });
    const second = makeItem({ id: 'second' });
    expect(resolveSelectionAfterAdd([], [first, second], 'story').items).toEqual([second]);
  });

  it('an empty import changes nothing', () => {
    const existing = makeItem();
    const result = resolveSelectionAfterAdd([existing], [], 'image');
    expect(result).toEqual({ items: [existing], capNotice: null, blocked: false });
  });
});

describe('capNoticeForFormat — notices follow the current format (QA #17)', () => {
  const photoNotice = {
    format: 'image' as const,
    message: 'Photo posts take 1 image. Remove the current one to pick another.',
  };

  it('shows the notice while its own format is current', () => {
    expect(capNoticeForFormat(photoNotice, 'image')).toBe(photoNotice.message);
  });

  it('hides a Photo notice after switching to Video or Reel', () => {
    expect(capNoticeForFormat(photoNotice, 'video')).toBeNull();
    expect(capNoticeForFormat(photoNotice, 'reel')).toBeNull();
    expect(capNoticeForFormat(photoNotice, 'story')).toBeNull();
  });

  it('returns null when there is no notice', () => {
    expect(capNoticeForFormat(null, 'image')).toBeNull();
  });
});

describe('getMediaCapNotice', () => {
  it('is null when nothing is selected yet', () => {
    expect(getMediaCapNotice('image', 0)).toBeNull();
    expect(getMediaCapNotice('story', 0)).toBeNull();
  });

  it('gives each format its own plain-language notice', () => {
    expect(getMediaCapNotice('image', 1)).toContain('Photo posts take 1 image.');
    expect(getMediaCapNotice('video', 1)).toContain('Video posts take 1 video.');
    expect(getMediaCapNotice('reel', 1)).toContain('Reels take 1 video.');
    expect(getMediaCapNotice('story', 1)).toContain('Stories take 1 file.');
    expect(getMediaCapNotice('text', 1)).toBeNull();
  });
});

describe('getMediaItemError for Text (QA #16)', () => {
  it('flags retained media as not used by text posts', () => {
    expect(getMediaItemError(makeItem(), 'text')).toBe('Text posts do not use media.');
  });
});
