const FB_CAPTION_MAX = 63206;

export function stripHtmlToPlainText(html) {
  return String(html || '')
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
    .trim();
}

export function normalizeItemGuid(item) {
  const guid = String(item.guid || '').trim();
  if (guid) return guid.slice(0, 500);
  const link = String(item.link || '').trim();
  if (link) return link.slice(0, 500);
  return `hash:${simpleHash(String(item.title || ''))}`;
}

function simpleHash(input) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function firstImgFromHtml(html) {
  if (!html) return null;
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] || null;
}

export function extractImageUrl(item) {
  const enclosure = item.enclosure;
  if (enclosure?.url && (!enclosure.type || String(enclosure.type).startsWith('image/'))) {
    return enclosure.url;
  }
  if (item['media:content']?.$?.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url;
  const content = String(item.content || item['content:encoded'] || item.description || '');
  return firstImgFromHtml(content);
}

export function extractDescription(item) {
  const snippet = String(item.contentSnippet || '').trim();
  const raw = snippet || String(item.content || item['content:encoded'] || item.description || '');
  const plain = snippet ? raw : stripHtmlToPlainText(raw);
  if (plain.length <= FB_CAPTION_MAX) return plain;
  return plain.slice(0, FB_CAPTION_MAX);
}

export function mapParserItem(item) {
  const title = String(item.title || '').trim();
  const link = String(item.link || '').trim();
  return {
    guid: normalizeItemGuid(item),
    title,
    description: extractDescription(item),
    link,
    imageUrl: extractImageUrl(item),
  };
}

export async function pickItemWithImage(items, isPosted) {
  for (let start = 0; start < items.length; start++) {
    const head = items[start];
    if (!head || (await isPosted(head.guid))) continue;
    if (head.imageUrl) return { item: head, index: start };

    for (let offset = 1; offset < items.length; offset++) {
      const next = start + offset;
      const prev = start - offset;
      if (next < items.length) {
        const item = items[next];
        if (item && !(await isPosted(item.guid)) && item.imageUrl) {
          return { item, index: next };
        }
      }
      if (prev >= 0) {
        const item = items[prev];
        if (item && !(await isPosted(item.guid)) && item.imageUrl) {
          return { item, index: prev };
        }
      }
    }
  }
  return null;
}
