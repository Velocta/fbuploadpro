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
  )}?fields=name,fan_count,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`;

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
    pageName: payload.name || null,
    fanCount: payload.fan_count,
    pageImage,
  };
}

export async function getAccountMetrics(accessToken) {
  const graphUrl = `https://graph.facebook.com/v19.0/me?fields=name,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`;
  const payload = await graphJson(graphUrl);

  let userImage = payload?.picture?.data?.url || null;

  if (!userImage) {
    const pictureUrl = `https://graph.facebook.com/v19.0/me/picture?redirect=0&type=large&access_token=${encodeURIComponent(accessToken)}`;
    const picturePayload = await graphJson(pictureUrl);
    userImage = picturePayload?.data?.url || null;
  }

  return {
    userName: payload.name || null,
    userImage,
  };
}
