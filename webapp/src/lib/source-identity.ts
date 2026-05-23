export type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'

/** Strip whitespace and leading @ (non-Facebook) while typing — matches server normalizeSourceUsername. */
export function sanitizeSourceIdentityInput(
  sourcePlatform: SourcePlatform,
  sourceUsername: string,
): string {
  const cleaned = sourceUsername.replace(/\s/g, '')
  if (sourcePlatform === 'facebook') return cleaned
  return cleaned.replace(/^@+/, '')
}
