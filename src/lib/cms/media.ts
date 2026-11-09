import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { storageClient, storageConfigured } from "@/lib/storage";

// Mediabibliotheek van de publieke site. Afbeeldingen worden verkleind tot
// maximaal 1800px breed en als WebP opgeslagen (behalve gif's), zodat de
// blog snel blijft. Met een ingestelde uploads-bucket staat het bestand daar;
// zonder bucket (lokaal) in de database.

export class MediaError extends Error {}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1800;
const ALLOWED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export type MediaItem = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: string;
  url: string;
};

export const mediaUrl = (id: string) => `/api/media/${id}`;

const toItem = (m: { id: string; filename: string; mime: string; size: number; width: number | null; height: number | null; alt: string; createdAt: Date }): MediaItem => ({
  id: m.id,
  filename: m.filename,
  mime: m.mime,
  size: m.size,
  width: m.width,
  height: m.height,
  alt: m.alt,
  createdAt: m.createdAt.toISOString(),
  url: mediaUrl(m.id),
});

export async function listMedia(): Promise<MediaItem[]> {
  const rows = await prisma.mediaFile.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, mime: true, size: true, width: true, height: true, alt: true, createdAt: true },
  });
  return rows.map(toItem);
}

export async function uploadMedia(file: File, by: string, alt = ""): Promise<MediaItem> {
  if (!(file.type in ALLOWED)) throw new MediaError("Alleen PNG, JPG, WEBP of GIF.");
  if (file.size === 0) throw new MediaError("Het bestand is leeg.");
  if (file.size > MAX_BYTES) throw new MediaError("Het bestand is te groot (max 8 MB).");

  let buffer = Buffer.from(await file.arrayBuffer());
  let mime = file.type;
  let ext = ALLOWED[mime];
  let width: number | null = null;
  let height: number | null = null;

  if (mime === "image/gif") {
    const meta = await sharp(buffer, { animated: true }).metadata().catch(() => null);
    width = meta?.width ?? null;
    height = meta?.pageHeight ?? meta?.height ?? null;
  } else {
    // Pixelbom-bescherming zit in sharp zelf (limitInputPixels).
    const img = sharp(buffer).rotate();
    const meta = await img.metadata().catch(() => null);
    if (!meta?.width || !meta.height) throw new MediaError("Dit bestand is geen geldige afbeelding.");
    const out = await img
      .resize({ width: Math.min(meta.width, MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    buffer = out.data;
    width = out.info.width;
    height = out.info.height;
    mime = "image/webp";
    ext = "webp";
  }

  const filename = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").slice(0, 80) || "afbeelding";
  const row = await prisma.mediaFile.create({
    data: { filename: `${filename}.${ext}`, mime, size: buffer.length, width, height, alt, uploadedBy: by },
  });

  if (storageConfigured("uploads")) {
    const key = `media/${row.id}.${ext}`;
    const { client, bucket } = storageClient("uploads");
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }));
    } catch (err) {
      await prisma.mediaFile.delete({ where: { id: row.id } }).catch(() => undefined);
      throw err;
    }
    await prisma.mediaFile.update({ where: { id: row.id }, data: { key } });
  } else {
    await prisma.mediaFile.update({ where: { id: row.id }, data: { data: buffer } });
  }
  return toItem(row);
}

export async function updateMediaAlt(id: string, alt: string): Promise<void> {
  await prisma.mediaFile.update({ where: { id }, data: { alt: alt.slice(0, 300) } });
}

/** Waar wordt dit bestand gebruikt? (Zodat verwijderen geen kapotte afbeeldingen oplevert.) */
export async function mediaUsage(id: string): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({ select: { title: true, featuredImageId: true, content: true, draft: true } });
  const needle = `"${id}"`;
  return posts
    .filter((p) => p.featuredImageId === id || JSON.stringify(p.content).includes(needle) || (p.draft && JSON.stringify(p.draft).includes(needle)))
    .map((p) => p.title || "(zonder titel)");
}

export async function deleteMedia(id: string): Promise<void> {
  const used = await mediaUsage(id);
  if (used.length) throw new MediaError(`Nog in gebruik in: ${used.slice(0, 3).join(", ")}${used.length > 3 ? "…" : ""}.`);
  const row = await prisma.mediaFile.findUnique({ where: { id }, select: { key: true } });
  if (!row) return;
  if (row.key && storageConfigured("uploads")) {
    const { client, bucket } = storageClient("uploads");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.key })).catch((err) => console.error("media: verwijderen uit bucket mislukt", err));
  }
  await prisma.mediaFile.delete({ where: { id } });
}

/** De bytes voor /api/media/[id]. */
export async function getMediaBytes(id: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const row = await prisma.mediaFile.findUnique({ where: { id }, select: { key: true, data: true, mime: true } });
  if (!row) return null;
  if (row.data) return { buffer: Buffer.from(row.data), mime: row.mime };
  if (row.key && storageConfigured("uploads")) {
    const { client, bucket } = storageClient("uploads");
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.key }));
    const bytes = (await res.Body?.transformToByteArray()) ?? new Uint8Array();
    return { buffer: Buffer.from(bytes), mime: row.mime };
  }
  return null;
}
