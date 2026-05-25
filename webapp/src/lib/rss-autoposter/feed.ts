const FB_CAPTION_MAX = 63206

export type ParsedRssItem = {
  guid: string
  title: string
  description: string
  link: string
  imageUrl: string | null
}

export function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeItemGuid(item: { guid?: string; link?: string; title?: string }): string {
  const guid = (item.guid || '').trim()
  if (guid) return guid.slice(0, 500)
  const link = (item.link || '').trim()
  if (link) return link.slice(0, 500)
  return `hash:${simpleHash(`${item.title || ''}`)}`
}

function simpleHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}

function firstImgFromHtml(html?: string): string | null {
  if (!html) return null
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m?.[1] || null
}

export function extractImageUrl(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as { url?: string; type?: string } | undefined
  if (enclosure?.url && (!enclosure.type || String(enclosure.type).startsWith('image/'))) {
    return enclosure.url
  }
  const media = (item as { 'media:content'?: { $?: { url?: string } } })['media:content']
  if (media?.$?.url) return media.$.url
  const thumb = (item as { 'media:thumbnail'?: { $?: { url?: string } } })['media:thumbnail']
  if (thumb?.$?.url) return thumb.$.url
  const content = String(item.content || item['content:encoded'] || item.description || '')
  return firstImgFromHtml(content)
}

export function extractDescription(item: Record<string, unknown>): string {
  const snippet = String(item.contentSnippet || '').trim()
  if (snippet) return hardCutCaption(snippet)
  const raw = String(item.content || item['content:encoded'] || item.description || '')
  return hardCutCaption(stripHtmlToPlainText(raw))
}

export function hardCutCaption(text: string): string {
  if (text.length <= FB_CAPTION_MAX) return text
  return text.slice(0, FB_CAPTION_MAX)
}

export function mapParserItem(item: Record<string, unknown>): ParsedRssItem {
  const title = String(item.title || '').trim()
  const link = String(item.link || '').trim()
  return {
    guid: normalizeItemGuid(item as { guid?: string; link?: string; title?: string }),
    title,
    description: extractDescription(item),
    link,
    imageUrl: extractImageUrl(item),
  }
}

/** Newest-first unposted item (backfill uses same walk). */
export function pickItemForSlot(
  items: ParsedRssItem[],
  isPosted: (guid: string) => boolean
): ParsedRssItem | null {
  for (const item of items) {
    if (!isPosted(item.guid)) return item
  }
  return null
}

export function pickItemWithImage(
  items: ParsedRssItem[],
  isPosted: (guid: string) => boolean
): { item: ParsedRssItem; index: number } | null {
  for (let start = 0; start < items.length; start++) {
    const head = items[start]
    if (!head || isPosted(head.guid)) continue
    if (head.imageUrl) return { item: head, index: start }

    for (let offset = 1; offset < items.length; offset++) {
      const next = start + offset
      const prev = start - offset
      if (next < items.length) {
        const item = items[next]
        if (item && !isPosted(item.guid) && item.imageUrl) return { item, index: next }
      }
      if (prev >= 0) {
        const item = items[prev]
        if (item && !isPosted(item.guid) && item.imageUrl) return { item, index: prev }
      }
    }
  }
  return null
}
