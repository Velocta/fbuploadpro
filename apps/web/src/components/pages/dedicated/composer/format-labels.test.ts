import { describe, it, expect } from 'vitest';
import { FORMAT_LABELS, FORMAT_PLURAL_LABELS, pluralFormatLabel } from './format-labels';

describe('pluralFormatLabel', () => {
  it('pluralizes Story as "Stories", never "Storys" (QA #14)', () => {
    expect(pluralFormatLabel('story')).toBe('Stories');
  });

  it('pluralizes every format correctly', () => {
    expect(pluralFormatLabel('text')).toBe('Texts');
    expect(pluralFormatLabel('image')).toBe('Photos');
    expect(pluralFormatLabel('video')).toBe('Videos');
    expect(pluralFormatLabel('reel')).toBe('Reels');
    expect(pluralFormatLabel('story')).toBe('Stories');
  });

  it('plural map covers exactly the same formats as the singular map', () => {
    expect(Object.keys(FORMAT_PLURAL_LABELS).sort()).toEqual(Object.keys(FORMAT_LABELS).sort());
  });
});
