import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autoExcerpt, blockSchema, postInputSchema, readingMinutes, slugify, type Block, type PostInput } from "./blog";
import { mediaUrl } from "./media";

// Blogberichten en categorieën: lezen voor de publieke site, en het beheer
// (concept, publiceren, verwijderen) voor Admin → Publieke site → Blog.

export type Category = { id: string; slug: string; name: string; position: number };

export type PostSummary = {
  id: string;
  slug: string;
  status: "published" | "draft";
  title: string;
  excerpt: string;
  categories: Category[];
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
};

export type PostFull = PostSummary & {
  content: Block[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  featuredImageId: string | null;
};

const parseBlocks = (v: unknown): Block[] => {
  if (!Array.isArray(v)) return [];
  return v.map((b) => blockSchema.safeParse(b)).filter((r) => r.success).map((r) => r.data!);
};

type Row = Prisma.BlogPostGetPayload<Record<string, never>>;

async function categoriesBySlug(): Promise<Map<string, Category>> {
  const rows = await prisma.blogCategory.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  return new Map(rows.map((c) => [c.slug, c]));
}

async function imagesById(ids: (string | null)[]) {
  const wanted = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (!wanted.length) return new Map<string, { url: string; alt: string; width: number | null; height: number | null }>();
  const rows = await prisma.mediaFile.findMany({ where: { id: { in: wanted } }, select: { id: true, alt: true, width: true, height: true } });
  return new Map(rows.map((m) => [m.id, { url: mediaUrl(m.id), alt: m.alt, width: m.width, height: m.height }]));
}

/** De bewerkbare velden van een rij, met het concept erover als dat er is. */
function editable(row: Row, useDraft: boolean): PostInput {
  const d = useDraft && row.draft && typeof row.draft === "object" && !Array.isArray(row.draft) ? (row.draft as Record<string, unknown>) : null;
  const base: PostInput = {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: parseBlocks(row.content),
    categories: row.categories,
    featuredImageId: row.featuredImageId,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    focusKeyword: row.focusKeyword,
    authorName: row.authorName,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
  if (!d) return base;
  const parsed = postInputSchema.safeParse({ ...base, ...d, content: parseBlocks(d.content ?? base.content) });
  return parsed.success ? parsed.data : base;
}

function toFull(row: Row, input: PostInput, cats: Map<string, Category>, images: Awaited<ReturnType<typeof imagesById>>): PostFull {
  return {
    id: row.id,
    slug: input.slug,
    status: row.status === "published" ? "published" : "draft",
    title: input.title,
    excerpt: input.excerpt || autoExcerpt(input.content),
    categories: input.categories.map((s) => cats.get(s)).filter((c): c is Category => Boolean(c)),
    image: input.featuredImageId ? images.get(input.featuredImageId) ?? null : null,
    authorName: input.authorName,
    publishedAt: input.publishedAt,
    updatedAt: row.updatedAt.toISOString(),
    readingMinutes: readingMinutes(input.content),
    content: input.content,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    focusKeyword: input.focusKeyword,
    featuredImageId: input.featuredImageId,
  };
}

// ---------------------------------------------------------------- publiek

export async function listCategories(): Promise<Category[]> {
  return prisma.blogCategory.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
}

/** Gepubliceerde berichten, nieuwste eerst. Een databasefout geeft een lege lijst. */
export async function listPublishedPosts(category?: string): Promise<PostSummary[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "published", publishedAt: { lte: new Date() }, ...(category ? { categories: { has: category } } : {}) },
      orderBy: { publishedAt: "desc" },
      take: 60,
    });
    const [cats, images] = await Promise.all([categoriesBySlug(), imagesById(rows.map((r) => r.featuredImageId))]);
    return rows.map((r) => toFull(r, editable(r, false), cats, images));
  } catch (err) {
    console.error("blog: lijst lezen mislukt", err);
    return [];
  }
}

export async function getPublishedPost(slug: string, preview = false): Promise<PostFull | null> {
  try {
    const row = await prisma.blogPost.findUnique({ where: { slug } });
    if (!row) return null;
    if (!preview && (row.status !== "published" || (row.publishedAt && row.publishedAt > new Date()))) return null;
    const input = editable(row, preview);
    const [cats, images] = await Promise.all([categoriesBySlug(), imagesById([input.featuredImageId, ...input.content.map((b) => (b.type === "image" ? b.mediaId : null))])]);
    return toFull(row, input, cats, images);
  } catch (err) {
    console.error("blog: bericht lezen mislukt", err);
    return null;
  }
}

/** Afbeeldingen in de inhoud (id → url/alt), voor het renderen van image-blokken. */
export async function imagesForBlocks(blocks: Block[]) {
  return imagesById(blocks.map((b) => (b.type === "image" ? b.mediaId : null)));
}

export async function relatedPosts(slug: string, take = 3): Promise<PostSummary[]> {
  const all = await listPublishedPosts();
  return all.filter((p) => p.slug !== slug).slice(0, take);
}

// ---------------------------------------------------------------- beheer

export type AdminPostRow = PostSummary & { hasDraft: boolean; seoTitle: string; seoDescription: string; updatedBy: string | null };

export async function listPostsAdmin(): Promise<AdminPostRow[]> {
  const rows = await prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" } });
  const [cats, images] = await Promise.all([categoriesBySlug(), imagesById(rows.map((r) => r.featuredImageId))]);
  return rows.map((r) => {
    const input = editable(r, true);
    return { ...toFull(r, input, cats, images), hasDraft: Boolean(r.draft), updatedBy: r.updatedBy };
  });
}

export type EditorPost = { id: string; status: "published" | "draft"; hasDraft: boolean; updatedAt: string; input: PostInput; images: Record<string, { url: string; alt: string }> };

export async function getPostForEditor(id: string): Promise<EditorPost | null> {
  const row = await prisma.blogPost.findUnique({ where: { id } });
  if (!row) return null;
  const input = editable(row, true);
  const images = await imagesById([input.featuredImageId, ...input.content.map((b) => (b.type === "image" ? b.mediaId : null))]);
  return {
    id: row.id,
    status: row.status === "published" ? "published" : "draft",
    hasDraft: Boolean(row.draft),
    updatedAt: row.updatedAt.toISOString(),
    input,
    images: Object.fromEntries(Array.from(images.entries()).map(([k, v]) => [k, { url: v.url, alt: v.alt }])),
  };
}

async function uniqueSlug(wanted: string, exceptId?: string): Promise<string> {
  const base = slugify(wanted) || "bericht";
  let slug = base;
  for (let n = 2; n < 100; n++) {
    const clash = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === exceptId) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createPost(by: string): Promise<string> {
  const slug = await uniqueSlug(`nieuw-bericht-${Date.now().toString(36)}`);
  const row = await prisma.blogPost.create({
    data: { slug, status: "draft", content: [], authorName: by, updatedBy: by },
    select: { id: true },
  });
  return row.id;
}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * Concept opslaan. Een nog nooit gepubliceerd bericht schrijven we direct in
 * de kolommen (er is niets om te beschermen); een gepubliceerd bericht krijgt
 * de wijzigingen in `draft`, zodat de live versie ongemoeid blijft.
 */
export async function savePostDraft(id: string, input: PostInput, by: string): Promise<{ slug: string }> {
  const row = await prisma.blogPost.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new Error("Bericht bestaat niet.");
  const slug = await uniqueSlug(input.slug || input.title || "bericht", id);
  const data = { ...input, slug, content: json(input.content), publishedAt: input.publishedAt ? new Date(input.publishedAt) : null };
  if (row.status === "published") {
    await prisma.blogPost.update({ where: { id }, data: { draft: json({ ...input, slug }), updatedBy: by } });
  } else {
    await prisma.blogPost.update({ where: { id }, data: { ...data, draft: Prisma.DbNull, updatedBy: by } });
  }
  return { slug };
}

export async function publishPost(id: string, input: PostInput, by: string): Promise<{ slug: string }> {
  const slug = await uniqueSlug(input.slug || input.title || "bericht", id);
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
  await prisma.blogPost.update({
    where: { id },
    data: { ...input, slug, content: json(input.content), publishedAt, status: "published", draft: Prisma.DbNull, updatedBy: by },
  });
  return { slug };
}

export async function unpublishPost(id: string, by: string): Promise<void> {
  // Het concept (als dat er is) wordt de werkversie; het bericht is offline.
  const row = await prisma.blogPost.findUnique({ where: { id } });
  if (!row) return;
  const input = editable(row, true);
  await prisma.blogPost.update({
    where: { id },
    data: { ...input, content: json(input.content), publishedAt: input.publishedAt ? new Date(input.publishedAt) : null, status: "draft", draft: Prisma.DbNull, updatedBy: by },
  });
}

export async function discardPostDraft(id: string): Promise<void> {
  await prisma.blogPost.update({ where: { id }, data: { draft: Prisma.DbNull } });
}

export async function deletePost(id: string): Promise<void> {
  await prisma.blogPost.delete({ where: { id } });
}

export async function createCategory(name: string): Promise<Category> {
  const slug = slugify(name);
  const existing = await prisma.blogCategory.findUnique({ where: { slug } });
  if (existing) return existing;
  const count = await prisma.blogCategory.count();
  return prisma.blogCategory.create({ data: { slug, name: name.trim(), position: count } });
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await prisma.blogCategory.update({ where: { id }, data: { name: name.trim() } });
}

export async function deleteCategory(id: string): Promise<void> {
  const cat = await prisma.blogCategory.findUnique({ where: { id } });
  if (!cat) return;
  const posts = await prisma.blogPost.findMany({ where: { categories: { has: cat.slug } }, select: { id: true, categories: true } });
  for (const p of posts) {
    await prisma.blogPost.update({ where: { id: p.id }, data: { categories: p.categories.filter((s) => s !== cat.slug) } });
  }
  await prisma.blogCategory.delete({ where: { id } });
}
