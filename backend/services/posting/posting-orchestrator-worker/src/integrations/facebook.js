export async function publishToFacebook(fbPageId, token, videoBlob, maxRetries, caption) {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    try {
      console.log(`🚀 [FB Attempt ${attempts}] uploading...`);

      const startRes = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}/video_reels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_phase: 'START' }),
      });
      const startData = await startRes.json();
      if (!startData.video_id) throw new Error(`Start Phase Failed: ${JSON.stringify(startData)}`);

      const uploadRes = await fetch(startData.upload_url, {
        method: 'POST',
        headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: videoBlob.size.toString() },
        body: videoBlob,
      });
      if (!uploadRes.ok) throw new Error('Binary upload failed');

      const finishRes = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}/video_reels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_phase: 'FINISH',
          video_id: startData.video_id,
          video_state: 'PUBLISHED',
          description: caption || '...',
        }),
      });
      const finishData = await finishRes.json();
      if (finishData.success) return true;
      throw new Error(`Finish Phase Failed: ${JSON.stringify(finishData)}`);
    } catch (err) {
      const isVerificationRequired =
        err.message &&
        err.message.toLowerCase().includes('confirm your identity');
      if (isVerificationRequired) throw err;

      const isAuthError =
        err.message &&
        err.message.includes('OAuthException') &&
        (err.message.includes('"code":190') || err.message.includes('"code": 190'));
      if (isAuthError) throw err;
      if (attempts >= maxRetries) throw new Error(`Upload failed after ${maxRetries} tries: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempts));
    }
  }
}
