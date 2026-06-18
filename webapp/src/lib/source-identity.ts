export type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'

/** Strip whitespace, resolve URLs, handles, and paths into clean target usernames/IDs. */
export function sanitizeSourceIdentityInput(
  sourcePlatform: SourcePlatform,
  sourceUsername: string,
): string {
  if (!sourceUsername) return ''
  
  let cleaned = sourceUsername.trim()
  
  // Handle leading @ if it exists (e.g. @https://... or @username)
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1).trim()
  }
  
  // Clean internal whitespaces if it's not a URL
  const isUrl = cleaned.includes('http') || cleaned.includes('.')
  if (!isUrl) {
    cleaned = cleaned.replace(/\s/g, '')
  }

  try {
    // If it looks like a URL or has domain components, try to parse it
    if (isUrl) {
      const urlString = cleaned.startsWith('http') ? cleaned : 'https://' + cleaned
      const url = new URL(urlString)
      
      if (sourcePlatform === 'facebook') {
        if (url.searchParams.has('id')) {
          return url.searchParams.get('id') || ''
        }
        const pathParts = url.pathname.split('/').filter(Boolean)
        const first = pathParts[0]
        if (first && pathParts.length > 1 && ['people', 'pages', 'groups', 'profile'].includes(first.toLowerCase())) {
          pathParts.shift()
        }
        if (pathParts[0]) {
          return pathParts[0]
        }
      } else if (sourcePlatform === 'instagram') {
        const pathParts = url.pathname.split('/').filter(Boolean)
        if (pathParts[0]) {
          return pathParts[0]
        }
      } else if (sourcePlatform === 'tiktok') {
        const pathParts = url.pathname.split('/').filter(Boolean)
        if (pathParts[0]) {
          return pathParts[0].replace(/^@+/, '')
        }
      } else if (sourcePlatform === 'youtube') {
        const pathParts = url.pathname.split('/').filter(Boolean)
        const first = pathParts[0]
        if (first && pathParts.length > 1 && ['c', 'channel', 'user'].includes(first.toLowerCase())) {
          pathParts.shift()
        }
        if (pathParts[0]) {
          return pathParts[0].replace(/^@+/, '')
        }
      }
    }
  } catch {
    // Fall back to text parsing if URL parsing fails
  }

  // Text-based fallback (e.g. "username/shorts" or "@username")
  const slashParts = cleaned.split('/')
  const firstSegment = slashParts[0] || cleaned
  
  return firstSegment.replace(/\s/g, '').replace(/^@+/, '')
}
