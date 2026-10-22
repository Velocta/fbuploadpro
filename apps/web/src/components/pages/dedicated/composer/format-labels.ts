import { type PostFormat } from '@fbuploadpro/contracts';

/** Singular format names shown across the composer. */
export const FORMAT_LABELS: Record<PostFormat, string> = {
  text: 'Text',
  image: 'Photo',
  video: 'Video',
  reel: 'Reel',
  story: 'Story',
};

/**
 * Plural format names as an explicit map — the single source for pluralized
 * format copy, so "Story" correctly becomes "Stories" (never "Storys").
 */
export const FORMAT_PLURAL_LABELS: Record<PostFormat, string> = {
  text: 'Texts',
  image: 'Photos',
  video: 'Videos',
  reel: 'Reels',
  story: 'Stories',
};

/** Plural display name for a format, e.g. "Stories" for `story`. */
export function pluralFormatLabel(format: PostFormat): string {
  return FORMAT_PLURAL_LABELS[format];
}
