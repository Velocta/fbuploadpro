export async function renderViaWebapp(env, payload) {
  const base = env.WEBAPP_RENDER_BASE_URL;
  const secret = env.RSS_WORKER_SECRET;
  if (!base || !secret) {
    throw new Error('WEBAPP_RENDER_BASE_URL and RSS_WORKER_SECRET required for template render');
  }

  const url = `${base.replace(/\/$/, '')}/api/v1/internal/facebook/rss-autoposter/render`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rss-worker-secret': secret,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || JSON.stringify(data));
  }
  return data.objectKey;
}
