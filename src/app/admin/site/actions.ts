"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { ALL_DEFS } from "@/lib/cms/pages";
import { resolvePage } from "@/lib/cms/resolve";
import { discardDraft, getEditorState, publish, saveDraft, setStatus, type EditorState } from "@/lib/cms/content";
import type { BlockDef, PageDoc, Resolved } from "@/lib/cms/types";

type Full = Resolved<Record<string, BlockDef>>;
type Result = { ok: true; savedAt: string } | { ok: false; error: string };

async function admin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return null;
  return session.user.name || session.user.email || "admin";
}

// Wat de editor stuurt wordt eerst door resolvePage gehaald: onbekende
// blokken/velden en verkeerde types vallen daar af.
function clean(slug: string, input: unknown): Full | null {
  const def = ALL_DEFS[slug];
  if (!def) return null;
  const f = (input ?? {}) as Partial<Full>;
  const doc: PageDoc = { order: f.order, hidden: f.hidden, blocks: f.blocks, seo: f.seo };
  return resolvePage(def, doc);
}

function refresh(slug: string) {
  const def = ALL_DEFS[slug];
  if (def?.path) revalidatePath(def.path);
  else revalidatePath("/", "layout");
  revalidatePath("/admin/site/paginas");
}

export async function saveDraftAction(slug: string, full: unknown): Promise<Result> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const cleaned = clean(slug, full);
  if (!cleaned) return { ok: false, error: "Onbekende pagina." };
  await saveDraft(slug, cleaned, by);
  revalidatePath("/admin/site/paginas");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function publishAction(slug: string, full: unknown): Promise<Result> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const cleaned = clean(slug, full);
  if (!cleaned) return { ok: false, error: "Onbekende pagina." };
  await publish(slug, cleaned, by);
  refresh(slug);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function discardDraftAction(slug: string): Promise<EditorState | { ok: false; error: string }> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  await discardDraft(slug);
  revalidatePath("/admin/site/paginas");
  const state = await getEditorState(slug);
  return state ?? { ok: false, error: "Onbekende pagina." };
}

export async function setStatusAction(slug: string, status: "published" | "draft"): Promise<Result> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const def = ALL_DEFS[slug];
  if (!def) return { ok: false, error: "Onbekende pagina." };
  if (status === "draft" && !def.canUnpublish) return { ok: false, error: "Deze pagina kan niet offline." };
  await setStatus(slug, status, by);
  refresh(slug);
  return { ok: true, savedAt: new Date().toISOString() };
}
