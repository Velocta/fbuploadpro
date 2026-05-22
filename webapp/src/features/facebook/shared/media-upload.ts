export async function uploadViaPresign(params: {
  file: File
  feature: 'direct-post' | 'direct-schedule' | 'inapp-schedule'
}) {
  const presignRes = await fetch('/api/v1/agency/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: params.file.name,
      contentType: params.file.type || 'application/octet-stream',
      feature: params.feature,
    }),
  })

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to get upload URL')
  }

  const { uploadUrl, objectKey } = await presignRes.json()

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': params.file.type || 'application/octet-stream' },
    body: params.file,
  })

  if (!putRes.ok) {
    throw new Error('Failed to upload file to storage')
  }

  return objectKey as string
}
