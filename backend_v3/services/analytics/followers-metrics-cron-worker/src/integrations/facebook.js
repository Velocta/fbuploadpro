async function graphJson(url) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const errorMessage = payload?.error?.message || `Graph request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}

export async function getPageMetrics(fbPageId, accessToken) {
  const graphUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(
    fbPageId
  )}?fields=fan_count,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`;

  const payload = await graphJson(graphUrl);

  if (typeof payload.fan_count !== 'number') {
    throw new Error('fan_count missing in Graph response');
  }

  let pageImage = payload?.picture?.data?.url || null;

  if (!pageImage) {
    const pictureUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(
      fbPageId
    )}/picture?redirect=0&type=large&access_token=${encodeURIComponent(accessToken)}`;
    const picturePayload = await graphJson(pictureUrl);
    pageImage = picturePayload?.data?.url || null;
  }

  return {
    fanCount: payload.fan_count,
    pageImage,
  };
}
