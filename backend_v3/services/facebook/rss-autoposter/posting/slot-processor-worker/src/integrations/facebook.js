const META_GRAPH_VERSION = 'v19.0';

export async function publishPhotoPost({ pageId, pageToken, caption, fileUrl }) {
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

export async function postFirstComment({ graphPostId, pageToken, message }) {
  const params = new URLSearchParams({ access_token: pageToken, message });
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${graphPostId}/comments?${params}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
}
