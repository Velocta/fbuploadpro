import { describe, it, expect } from 'vitest';
import { getPreviewMedia } from './composer-preview';
import type { ComposerMediaItem } from './composer-media-area';

function makeItem(overrides: Partial<ComposerMediaItem> = {}): ComposerMediaItem {
  return {
    id: 'media-1',
    name: 'photo.png',
    mediaType: 'image',
    url: 'https://example.com/photo.png',
    ...overrides,
  };
}

describe('getPreviewMedia (QA #16)', () => {
  it('never shows retained media in a Text preview', () => {
    expect(getPreviewMedia('text', [makeItem()])).toBeUndefined();
  });

  it('shows the first selected item for media formats', () => {
    const first = makeItem({ id: 'first' });
    const second = makeItem({ id: 'second' });
    expect(getPreviewMedia('image', [first, second])).toBe(first);
    expect(getPreviewMedia('reel', [first])?.id).toBe('first');
    expect(getPreviewMedia('story', [first])?.id).toBe('first');
  });

  it('returns undefined when nothing is selected', () => {
    expect(getPreviewMedia('image', [])).toBeUndefined();
    expect(getPreviewMedia('text', [])).toBeUndefined();
  });
});
