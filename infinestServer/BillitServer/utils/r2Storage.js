const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let client = null;

function isConfigured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getClient() {
  if (!isConfigured()) throw new Error("Cloudflare R2 is not configured (check R2_* env vars).");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

async function getSignedViewUrl(key) {
  const expiresIn = parseInt(process.env.R2_SIGNED_URL_TTL, 10) || 3600;
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    { expiresIn }
  );
}

// Content-Type and Content-Length are signed, so the browser must upload exactly that type and size
async function getSignedUploadUrl(key, contentType, contentLength, expiresIn = 300) {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn, signableHeaders: new Set(["content-type", "content-length"]) }
  );
}

async function uploadObject(key, body, contentType) {
  await getClient().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType })
  );
}

async function deleteObjects(keys) {
  if (!keys || keys.length === 0) return;
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    })
  );
}

module.exports = { isConfigured, getClient, getSignedViewUrl, getSignedUploadUrl, uploadObject, deleteObjects };
