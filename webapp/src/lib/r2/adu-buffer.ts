import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const PRESIGN_DOWNLOAD_SECONDS = 3600

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
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

function getBucket() {
  return process.env.R2_ADU_BUFFER_BUCKET || 'fbuploadpro-adu-buffer'
}

export async function createAduBufferDownloadUrl(objectKey: string): Promise<string> {
  const client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
  })
  return getSignedUrl(client, command, { expiresIn: PRESIGN_DOWNLOAD_SECONDS })
}
