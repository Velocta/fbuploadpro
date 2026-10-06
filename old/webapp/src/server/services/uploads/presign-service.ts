import 'server-only'

import {
  buildUserMediaObjectKey,
  createPresignedUploadUrl,
  USER_MEDIA_MAX_BYTES,
} from '@/lib/r2/user-media'

const ALLOWED_FEATURES = new Set([
  'direct-post',
  'direct-schedule',
  'inapp-schedule',
  'rss-autoposter',
])

export async function createAgencyUploadPresign(params: {
  agencyId: string
  filename: string
  contentType: string
  feature: string
}) {
  if (!ALLOWED_FEATURES.has(params.feature)) {
    throw new Error('Invalid upload feature')
  }

  const contentType = params.contentType || 'application/octet-stream'
  const isImage = contentType.startsWith('image/')
  const isVideo = contentType.startsWith('video/')
  if (!isImage && !isVideo) {
    throw new Error('Only image and video uploads are supported')
  }

  const maxBytes = isImage ? USER_MEDIA_MAX_BYTES.image : USER_MEDIA_MAX_BYTES.video
  void maxBytes

  const objectKey = buildUserMediaObjectKey(params.feature, params.agencyId, params.filename)
  const { uploadUrl } = await createPresignedUploadUrl({ objectKey, contentType })
  return { uploadUrl, objectKey }
}
