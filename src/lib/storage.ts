import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

// The object storage the app uses, as three separate buckets:
// - uploads: customers' files and article images (STORAGE_*)
// - backups: the hourly database copies (BACKUP_STORAGE_*, or the uploads
//   bucket when not set)
// - legacy:  the previous bucket (LEGACY_STORAGE_*), only read from while
//   its files are being moved over — see src/lib/storageMigration.ts
// Each takes ENDPOINT, REGION, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET and
// optionally PATH_STYLE ("false" for buckets using virtual-hosted URLs).
export type StorageTarget = "uploads" | "backups" | "legacy";

const PREFIX: Record<StorageTarget, string> = {
  uploads: "STORAGE_",
  backups: "BACKUP_STORAGE_",
  legacy: "LEGACY_STORAGE_",
};

type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  pathStyle: boolean;
};

function readConfig(prefix: string): StorageConfig | null {
  const env = (name: string) => process.env[`${prefix}${name}`]?.trim() || "";
  const endpoint = env("ENDPOINT");
  const accessKeyId = env("ACCESS_KEY_ID");
  const secretAccessKey = env("SECRET_ACCESS_KEY");
  const bucket = env("BUCKET");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint,
    region: env("REGION") || "auto",
    accessKeyId,
    secretAccessKey,
    bucket,
    pathStyle: env("PATH_STYLE") !== "false",
  };
}

export function storageConfig(target: StorageTarget): StorageConfig | null {
  if (target === "backups") return readConfig(PREFIX.backups) ?? readConfig(PREFIX.uploads);
  return readConfig(PREFIX[target]);
}

export function storageConfigured(target: StorageTarget): boolean {
  return storageConfig(target) !== null;
}

const clients = new Map<string, S3Client>();

export function storageClient(target: StorageTarget): { client: S3Client; bucket: string } {
  const config = storageConfig(target);
  if (!config) throw new Error(`Bestandsopslag (${PREFIX[target]}*) is niet ingesteld.`);
  const cacheKey = `${target}:${config.endpoint}:${config.bucket}:${config.accessKeyId}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.pathStyle,
    });
    clients.set(cacheKey, client);
  }
  return { client, bucket: config.bucket };
}

export async function objectExists(target: StorageTarget, key: string): Promise<boolean> {
  const { client, bucket } = storageClient(target);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (err as { name?: string }).name === "NotFound") return false;
    throw err;
  }
}

// Where an uploaded file lives: the uploads bucket, or while files are
// still being moved, the previous bucket.
export async function locateUpload(key: string): Promise<StorageTarget> {
  if (!storageConfigured("legacy")) return "uploads";
  if (await objectExists("uploads", key)) return "uploads";
  return (await objectExists("legacy", key)) ? "legacy" : "uploads";
}
