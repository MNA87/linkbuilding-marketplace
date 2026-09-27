import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { BACKUP_PREFIX } from "@/lib/databaseBackup";
import { storageClient, storageConfigured, type StorageTarget } from "@/lib/storage";

// Moving the files of the previous bucket (LEGACY_STORAGE_*) into the new
// ones: database copies to the backups bucket, everything else to the
// uploads bucket. Files already there are skipped, so it can simply be run
// again until nothing is left. The previous bucket itself is never changed.

export function destinationFor(key: string): StorageTarget {
  return key.startsWith(BACKUP_PREFIX) ? "backups" : "uploads";
}

async function listKeys(target: StorageTarget): Promise<Map<string, string | undefined>> {
  const { client, bucket } = storageClient(target);
  const keys = new Map<string, string | undefined>();
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const obj of page.Contents ?? []) if (obj.Key) keys.set(obj.Key, obj.ETag);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export type LegacyStatus = { configured: boolean; total: number; pending: string[] };

export async function legacyStatus(): Promise<LegacyStatus> {
  if (!storageConfigured("legacy")) return { configured: false, total: 0, pending: [] };
  const [legacy, uploads, backups] = await Promise.all([listKeys("legacy"), listKeys("uploads"), listKeys("backups")]);
  const pending = Array.from(legacy.keys()).filter((key) =>
    destinationFor(key) === "backups" ? !backups.has(key) : !uploads.has(key)
  );
  return { configured: true, total: legacy.size, pending };
}

export async function moveLegacyFiles(): Promise<{ copied: number; failed: number; left: number }> {
  const { pending } = await legacyStatus();
  const from = storageClient("legacy");
  let copied = 0;
  let failed = 0;
  for (const key of pending) {
    try {
      const res = await from.client.send(new GetObjectCommand({ Bucket: from.bucket, Key: key }));
      const body = await res.Body?.transformToByteArray();
      if (!body) throw new Error("leeg bestand");
      const to = storageClient(destinationFor(key));
      await to.client.send(
        new PutObjectCommand({ Bucket: to.bucket, Key: key, Body: body, ContentType: res.ContentType })
      );
      copied++;
    } catch (err) {
      failed++;
      console.error(`opslag: ${key} overzetten mislukt`, err);
    }
  }
  console.log(`opslag: ${copied} bestand(en) overgezet, ${failed} mislukt`);
  return { copied, failed, left: (await legacyStatus()).pending.length };
}
