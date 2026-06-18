async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return bufferToHex(hashBuffer);
}

function bufferToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
}

async function hmacHex(key, data) {
  const signature = await hmac(key, data);
  return bufferToHex(signature);
}

async function getSigningKey(secretAccessKey, date, region, service) {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + secretAccessKey), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

/**
 * Generates an AWS Signature V4 pre-signed URL for an R2 object GET request.
 */
export async function getR2PresignedUrl({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  expiresInSeconds = 3600
}) {
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  
  // R2 key paths should be properly encoded but preserving slashes
  const encodedKey = objectKey
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  const url = `https://${host}/${encodedKey}`;

  const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.substring(0, 8);

  const method = 'GET';
  const service = 's3';
  const region = 'auto';

  const scope = `${date}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${scope}`;

  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': expiresInSeconds.toString(),
    'X-Amz-SignedHeaders': 'host'
  };

  const sortedQueryString = Object.keys(query)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');

  const canonicalRequest = [
    method,
    `/${encodedKey}`,
    sortedQueryString,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const canonicalRequestHash = await sha256(canonicalRequest);

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    canonicalRequestHash
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, date, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  return `${url}?${sortedQueryString}&X-Amz-Signature=${signature}`;
}
