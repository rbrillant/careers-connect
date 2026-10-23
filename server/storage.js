import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ---------------------------------------------------------------------------
// Video storage abstraction.
//
// Supports, in order of preference:
//   1. IDrive e2     (S3-compatible, no credit card, 10 GB free)
//   2. Backblaze B2  (S3-compatible, no credit card, 10 GB free)
//   3. Cloudflare R2 (S3-compatible, requires a card to activate)
//   4. Local disk    (development default)
//
// Set the env vars for one provider and it is used automatically.
// Video references stored in the database are always the object KEY, so the
// provider can be changed later without migrating data.
// ---------------------------------------------------------------------------

const env = process.env

// ---- IDrive e2 --------------------------------------------------------
// Endpoint looks like https://xyz1.ch11.idrivee2-2.com (no region in the URL;
// use the region shown in the IDrive console, e.g. us-east-1 or eu-central-1).
const e2 = {
  keyId: env.E2_ACCESS_KEY_ID,
  appKey: env.E2_SECRET_ACCESS_KEY,
  bucket: env.E2_BUCKET,
  endpoint: env.E2_ENDPOINT,
  region: env.E2_REGION,
  publicUrl: env.E2_PUBLIC_URL,
}
export const useE2 = Boolean(e2.keyId && e2.appKey && e2.bucket && e2.endpoint)

// ---- Backblaze B2 -----------------------------------------------------
const b2 = {
  keyId: env.B2_KEY_ID,
  appKey: env.B2_APPLICATION_KEY,
  bucket: env.B2_BUCKET,
  endpoint: env.B2_ENDPOINT, // e.g. https://s3.us-west-004.backblazeb2.com
  region: env.B2_REGION, // e.g. us-west-004
  publicUrl: env.B2_PUBLIC_URL,
}
export const useB2 = Boolean(
  !useE2 && b2.keyId && b2.appKey && b2.bucket && b2.endpoint
)

// ---- Cloudflare R2 ----------------------------------------------------
const r2 = {
  accountId: env.R2_ACCOUNT_ID,
  keyId: env.R2_ACCESS_KEY_ID,
  appKey: env.R2_SECRET_ACCESS_KEY,
  bucket: env.R2_BUCKET,
  publicUrl: env.R2_PUBLIC_URL,
  endpointOverride: env.R2_ENDPOINT_OVERRIDE,
}
export const useR2 = Boolean(
  !useE2 && !useB2 && r2.accountId && r2.keyId && r2.appKey && r2.bucket
)

// Which provider is active, and its settings, in a uniform shape.
const provider = useE2
  ? {
      name: 'e2',
      bucket: e2.bucket,
      endpoint: e2.endpoint,
      region: e2.region || 'us-east-1',
      forcePathStyle: true, // IDrive e2 requires path-style addressing
      credentials: { accessKeyId: e2.keyId, secretAccessKey: e2.appKey },
      publicUrl: e2.publicUrl,
    }
  : useB2
    ? {
        name: 'b2',
        bucket: b2.bucket,
        endpoint: b2.endpoint,
        region: b2.region || 'us-east-1',
        forcePathStyle: true, // B2 requires path-style addressing
        credentials: { accessKeyId: b2.keyId, secretAccessKey: b2.appKey },
        publicUrl: b2.publicUrl,
      }
    : useR2
      ? {
          name: 'r2',
          bucket: r2.bucket,
          endpoint:
            r2.endpointOverride ||
            `https://${r2.accountId}.r2.cloudflarestorage.com`,
          region: 'auto',
          forcePathStyle: Boolean(r2.endpointOverride),
          credentials: { accessKeyId: r2.keyId, secretAccessKey: r2.appKey },
          publicUrl: r2.publicUrl,
        }
      : null

export const useRemoteStorage = Boolean(provider)
export const storageName = provider ? provider.name : 'local'

let s3 = null
if (provider) {
  s3 = new S3Client({
    region: provider.region,
    endpoint: provider.endpoint,
    forcePathStyle: provider.forcePathStyle,
    credentials: provider.credentials,
  })
}

/**
 * Upload a buffer to remote storage.
 * @returns {Promise<string>} public URL when configured, otherwise the object key.
 */
export async function uploadObject(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: provider.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  )
  return publicUrlFor(key)
}

export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: provider.bucket, Key: key }))
}

export function publicUrlFor(key) {
  if (provider?.publicUrl) {
    return `${provider.publicUrl.replace(/\/$/, '')}/${key}`
  }
  return key
}

/**
 * Temporary signed URL for a private bucket, so the admin dashboard can play
 * the video without making the bucket public.
 */
export async function signedUrlFor(key, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: provider.bucket, Key: key }),
    { expiresIn }
  )
}

/**
 * Resolve a stored video reference into something the browser can load.
 * - Local disk paths (/uploads/...) are returned unchanged (served by Express).
 * - Full http(s) URLs are returned unchanged.
 * - Object keys get a public or signed URL.
 */
export async function resolveVideoUrl(stored) {
  if (!stored) return null
  if (stored.startsWith('http')) return stored
  if (stored.startsWith('/uploads/')) return stored

  if (useRemoteStorage) {
    if (provider.publicUrl) return publicUrlFor(stored)
    return signedUrlFor(stored)
  }
  return stored
}

// ---- Backwards-compatible aliases -------------------------------------
export const uploadToR2 = uploadObject
export const deleteFromR2 = deleteObject
