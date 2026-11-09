"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteMedia, listMedia, MediaError, mediaUsage, updateMediaAlt, uploadMedia, type MediaItem } from "@/lib/cms/media";

type Fail = { ok: false; error: string };

async function admin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return null;
  return session.user.name || session.user.email || "admin";
}

export async function listMediaAction(): Promise<MediaItem[]> {
  if (!(await admin())) return [];
  return listMedia();
}

export async function uploadMediaAction(formData: FormData): Promise<MediaItem | Fail> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Geen bestand ontvangen." };
  const alt = typeof formData.get("alt") === "string" ? String(formData.get("alt")) : "";
  try {
    return await uploadMedia(file, by, alt);
  } catch (err) {
    if (err instanceof MediaError) return { ok: false, error: err.message };
    console.error("media: upload mislukt", err);
    return { ok: false, error: "Uploaden is mislukt. Is de bestandsopslag ingesteld?" };
  }
}

export async function updateMediaAltAction(id: string, alt: string): Promise<{ ok: true } | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  await updateMediaAlt(id, alt);
  return { ok: true };
}

export async function mediaUsageAction(id: string): Promise<string[]> {
  if (!(await admin())) return [];
  return mediaUsage(id);
}

export async function deleteMediaAction(id: string): Promise<{ ok: true } | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  try {
    await deleteMedia(id);
    return { ok: true };
  } catch (err) {
    if (err instanceof MediaError) return { ok: false, error: err.message };
    console.error("media: verwijderen mislukt", err);
    return { ok: false, error: "Verwijderen is mislukt." };
  }
}
