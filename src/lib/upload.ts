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
