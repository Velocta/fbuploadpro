const META_GRAPH_VERSION = 'v19.0';

export async function publishFeedPost({ pageId, pageToken, mediaType, caption, fileUrl }) {
  if (mediaType === 'text') {
    const params = new URLSearchParams({
      access_token: pageToken,
      message: caption || '',
    });
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed?${params}`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok || !data.id) throw new Error(JSON.stringify(data));
    return String(data.id);
  }

  if (mediaType === 'image') {
    const params = new URLSearchParams({
      access_token: pageToken,
      url: fileUrl,
      caption: caption || '',
    });
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos?${params}`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return String(data.post_id || data.id || '');
  }

  const params = new URLSearchParams({
    access_token: pageToken,
    file_url: fileUrl,
    description: caption || '',
  });
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/videos?${params}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(JSON.stringify(data));
  return String(data.id);
}

export async function postFirstComment({ graphPostId, pageToken, message }) {
  const params = new URLSearchParams({ access_token: pageToken, message });
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${graphPostId}/comments?${params}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
}
