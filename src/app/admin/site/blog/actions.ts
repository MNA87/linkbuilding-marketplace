"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { categoryNameSchema, postInputSchema } from "@/lib/cms/blog";
import {
  createCategory,
  createPost,
  deleteCategory,
  deletePost,
  discardPostDraft,
  getPostForEditor,
  listCategories,
  publishPost,
  renameCategory,
  savePostDraft,
  unpublishPost,
  type Category,
  type EditorPost,
} from "@/lib/cms/blogContent";

type Fail = { ok: false; error: string };
type Saved = { ok: true; savedAt: string; slug: string };

async function admin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return null;
  return session.user.name || session.user.email || "admin";
}

function refreshBlog(slugs: string[] = []) {
  revalidatePath("/blog");
  for (const s of slugs) revalidatePath(`/blog/${s}`);
  revalidatePath("/admin/site/blog");
}

export async function createPostAction(): Promise<{ id: string } | Fail> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  return { id: await createPost(by) };
}

export async function savePostAction(id: string, input: unknown): Promise<Saved | Fail> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  try {
    const { slug } = await savePostDraft(id, parsed.data, by);
    revalidatePath("/admin/site/blog");
    return { ok: true, savedAt: new Date().toISOString(), slug };
  } catch (err) {
    console.error("blog: concept opslaan mislukt", err);
    return { ok: false, error: "Opslaan is mislukt." };
  }
}

export async function publishPostAction(id: string, input: unknown): Promise<Saved | Fail> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  if (!parsed.data.title.trim()) return { ok: false, error: "Geef het bericht eerst een titel." };
  try {
    const { slug } = await publishPost(id, parsed.data, by);
    refreshBlog([slug, parsed.data.slug]);
    return { ok: true, savedAt: new Date().toISOString(), slug };
  } catch (err) {
    console.error("blog: publiceren mislukt", err);
    return { ok: false, error: "Publiceren is mislukt." };
  }
}

export async function unpublishPostAction(id: string): Promise<EditorPost | Fail> {
  const by = await admin();
  if (!by) return { ok: false, error: "Niet toegestaan." };
  await unpublishPost(id, by);
  const post = await getPostForEditor(id);
  refreshBlog(post ? [post.input.slug] : []);
  return post ?? { ok: false, error: "Bericht bestaat niet." };
}

export async function discardPostDraftAction(id: string): Promise<EditorPost | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  await discardPostDraft(id);
  revalidatePath("/admin/site/blog");
  const post = await getPostForEditor(id);
  return post ?? { ok: false, error: "Bericht bestaat niet." };
}

export async function deletePostAction(id: string): Promise<{ ok: true } | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  const post = await getPostForEditor(id);
  await deletePost(id);
  refreshBlog(post ? [post.input.slug] : []);
  return { ok: true };
}

export async function listCategoriesAction(): Promise<Category[]> {
  if (!(await admin())) return [];
  return listCategories();
}

export async function createCategoryAction(name: string): Promise<Category | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige naam." };
  const cat = await createCategory(parsed.data);
  refreshBlog();
  return cat;
}

export async function renameCategoryAction(id: string, name: string): Promise<{ ok: true } | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige naam." };
  await renameCategory(id, parsed.data);
  refreshBlog();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<{ ok: true } | Fail> {
  if (!(await admin())) return { ok: false, error: "Niet toegestaan." };
  await deleteCategory(id);
  refreshBlog();
  return { ok: true };
}
