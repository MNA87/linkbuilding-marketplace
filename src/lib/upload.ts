import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Whitelist only — never a blacklist. Executables, scripts, HTML, and
// anything else not explicitly listed here is rejected by default.
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

export class UploadValidationError extends Error {}

export function validateUpload(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new UploadValidationError("Bestand is te groot (max 10MB).");
  }
  if (file.size === 0) {
    throw new UploadValidationError("Bestand is leeg.");
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new UploadValidationError(
      "Bestandstype niet toegestaan. Toegestaan: PDF, Word, PNG, JPG, WEBP, TXT."
    );
  }
  return ext;
}

function getS3Client() {
  const { STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY } = process.env;
  if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) {
    throw new Error("Storage (STORAGE_*) omgevingsvariabelen ontbreken.");
  }
  return new S3Client({
    endpoint: STORAGE_ENDPOINT,
    region: STORAGE_REGION || "auto",
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY_ID,
      secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

// Uploads an already-validated file and returns its storage key. Callers
// build the servable URL themselves (or serve it back through an
// authenticated API route) — the bucket is not assumed to be public.
export async function uploadOrderFile(file: File): Promise<string> {
  const ext = validateUpload(file);
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET ontbreekt in de omgevingsvariabelen.");

  const key = `order-uploads/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  return key;
}

// Files aren't served from a public bucket — anyone who needs to view one
// (the order's customer, its publisher, or an admin) gets a short-lived
// signed URL instead, checked against the order relationship by the caller.
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET ontbreekt in de omgevingsvariabelen.");
  const client = getS3Client();
  // These links are rendered server-side into a page that may sit open for
  // a while before the download is clicked — an hour is generous but still
  // short-lived compared to a permanent public URL.
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
// Kept deliberately small — this is a single featured image for a blog
// post, not a photo dump, and a multi-MB upload only slows the published
// page down once it lands on the target WordPress site.
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function validateArticleImage(file: File) {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new UploadValidationError("Afbeelding is te groot (max 2MB).");
  }
  if (file.size === 0) {
    throw new UploadValidationError("Afbeelding is leeg.");
  }
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    throw new UploadValidationError("Afbeeldingstype niet toegestaan. Toegestaan: PNG, JPG, WEBP, GIF.");
  }
  return ext;
}

// The order's single featured/main image is stored the same way as the old
// order attachments (private bucket, never a public URL) — the filename
// alone is the key, since the caller always prefixes it with
// "article-images/".
export async function uploadArticleImage(file: File): Promise<string> {
  const ext = validateArticleImage(file);
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET ontbreekt in de omgevingsvariabelen.");

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `article-images/${filename}`,
      Body: buffer,
      ContentType: file.type,
    })
  );

  return filename;
}

// Served through /api/article-images/[key], which redirects here — a fresh
// signed URL is minted on every view, so the image keeps working forever
// even though each individual link expires after an hour.
export async function getArticleImageSignedUrl(filename: string): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET ontbreekt in de omgevingsvariabelen.");
  const client = getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: `article-images/${filename}` }), {
    expiresIn: 3600,
  });
}

// Used only when re-uploading an article image into a site's own WordPress
// Media Library at publish time — that needs the actual bytes, not a link.
export async function getArticleImageBuffer(filename: string): Promise<{ buffer: Buffer; contentType: string }> {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET ontbreekt in de omgevingsvariabelen.");
  const client = getS3Client();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `article-images/${filename}` }));
  const bytes = (await res.Body?.transformToByteArray()) ?? new Uint8Array();
  return { buffer: Buffer.from(bytes), contentType: res.ContentType || "application/octet-stream" };
}
