export async function uploadViaPresign(params: {
  file: File
  feature: 'direct-post' | 'direct-schedule' | 'inapp-schedule'
  onProgress?: (pct: number) => void
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

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const percentComplete = (event.loaded / event.total) * 100
        params.onProgress(percentComplete)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(objectKey as string)
      } else {
        reject(new Error(`Failed to upload file to storage (Status: ${xhr.status})`))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Failed to upload file to storage due to a network error'))
    }

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', params.file.type || 'application/octet-stream')
    xhr.send(params.file)
  })
}
