import 'server-only'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const PRESIGN_UPLOAD_SECONDS = 30 * 60
const PRESIGN_DOWNLOAD_SECONDS = 60 * 60

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getR2Client() {
  const accountId = requireEnv('R2_ACCOUNT_ID')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

function getUserMediaBucket() {
  return process.env.R2_USER_MEDIA_BUCKET || 'fbuploadpro-user-media'
}

export function buildUserMediaObjectKey(feature: string, agencyId: string, filename: string) {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
  return `${feature}/${agencyId}/${randomUUID()}.${ext}`
}

export async function createPresignedUploadUrl(params: {
  objectKey: string
  contentType: string
}) {
  const client = getR2Client()
  const command = new PutObjectCommand({
    Bucket: getUserMediaBucket(),
    Key: params.objectKey,
    ContentType: params.contentType,
  })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_UPLOAD_SECONDS })
  return { uploadUrl, objectKey: params.objectKey }
}

export async function createPresignedDownloadUrl(objectKey: string) {
  const client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: getUserMediaBucket(),
    Key: objectKey,
  })
  return getSignedUrl(client, command, { expiresIn: PRESIGN_DOWNLOAD_SECONDS })
}

export async function deleteUserMediaObject(objectKey: string) {
  const client = getR2Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getUserMediaBucket(),
      Key: objectKey,
    })
  )
}

export const USER_MEDIA_MAX_BYTES = {
  image: 10 * 1024 * 1024,
  video: 10 * 1024 * 1024 * 1024,
} as const
