import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_DEFS, CMS_PAGES, settingsPage, type CmsSlug } from "./pages";
import { diffPage, fillTokens, isEmptyDoc, resolvePage } from "./resolve";
import type { BlockDef, PageDef, PageDoc, PageStatus, Resolved } from "./types";

type Row = { status: string; content: unknown; draft: unknown; updatedAt: Date; updatedBy: string | null; publishedAt: Date | null };

// Een databasefout mag de publieke site nooit platleggen: dan gewoon de
// standaardteksten uit code.
async function readRow(slug: string): Promise<Row | null> {
  try {
    return await prisma.sitePage.findUnique({ where: { slug } });
  } catch (err) {
    console.error(`CMS: pagina "${slug}" lezen mislukt, standaardtekst gebruikt`, err);
    return null;
  }
}

const asDoc = (v: unknown): PageDoc | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as PageDoc) : null);

export type SiteSettings = Resolved<(typeof settingsPage)["blocks"]>["blocks"];

/** Site-instellingen (cijfers, contact, prijskaarten) zoals ze live staan. */
export async function getSiteSettings(): Promise<{ settings: SiteSettings; tokens: Record<string, string> }> {
  const row = await readRow(settingsPage.slug);
  const settings = resolvePage(settingsPage, asDoc(row?.content)).blocks;
  const tokens = {
    sites: settings.cijfers.siteCount,
    plaatsingen: settings.cijfers.placementCount,
    prijsBlog: settings.cijfers.priceBlogFrom,
    prijsHomepage: settings.cijfers.priceHomepageFrom,
    email: settings.contact.contactEmail,
    landen: settings.contact.countries,
    uren: settings.contact.hours,
  };
  return { settings: fillTokens(settings, tokens), tokens };
}

/** Is dit verzoek een voorbeeld vanuit de editor, door een admin? */
export async function isAdminPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
  if (searchParams?.cms !== "preview") return false;
  const session = await getServerSession(authOptions).catch(() => null);
  return session?.user.role === "admin";
}

/** Inhoud van een publieke pagina, met tokens ingevuld. Concept = null (niet tonen). */
export async function getPublicPage<S extends CmsSlug>(slug: S, preview = false) {
  const def = CMS_PAGES[slug] as unknown as PageDef<(typeof CMS_PAGES)[S]["blocks"]>;
  const [row, { tokens }] = await Promise.all([readRow(slug), getSiteSettings()]);
  if (!preview && row?.status === "draft") return null;
  const doc = preview ? asDoc(row?.draft) ?? asDoc(row?.content) : asDoc(row?.content);
  const resolved = resolvePage(def, doc);
  return fillTokens(resolved, tokens);
}

/** Alleen de SEO-gegevens, voor generateMetadata. */
export async function getPageSeo(slug: CmsSlug) {
  const row = await readRow(slug);
  const { tokens } = await getSiteSettings();
  return fillTokens(resolvePage(CMS_PAGES[slug] as PageDef, asDoc(row?.content)).seo, tokens);
}

// ---------------------------------------------------------------- editor

export type EditorState = {
  slug: string;
  status: PageStatus;
  full: Resolved<Record<string, BlockDef>>;
  hasDraft: boolean;
  updatedAt: string | null;
  publishedAt: string | null;
};

export async function getEditorState(slug: string): Promise<EditorState | null> {
  const def = ALL_DEFS[slug];
  if (!def) return null;
  const row = await prisma.sitePage.findUnique({ where: { slug } });
  const doc = asDoc(row?.draft) ?? asDoc(row?.content);
  return {
    slug,
    status: row?.status === "draft" ? "draft" : "published",
    full: resolvePage(def, doc),
    hasDraft: Boolean(row?.draft),
    updatedAt: row?.updatedAt.toISOString() ?? null,
    publishedAt: row?.publishedAt?.toISOString() ?? null,
  };
}

export type PageListItem = {
  slug: string;
  title: string;
  path: string;
  status: PageStatus;
  hasDraft: boolean;
  customized: boolean;
  seo: Resolved<Record<string, BlockDef>>["seo"];
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function listPages(): Promise<PageListItem[]> {
  const rows = await prisma.sitePage.findMany();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return Object.values(CMS_PAGES).map((def) => {
    const row = bySlug.get(def.slug);
    const live = asDoc(row?.content);
    return {
      slug: def.slug,
      title: def.title,
      path: def.path,
      status: row?.status === "draft" ? "draft" : "published",
      hasDraft: Boolean(row?.draft),
      customized: !isEmptyDoc(live),
      seo: resolvePage(def as PageDef, live).seo,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

const json = (doc: PageDoc): Prisma.InputJsonValue => doc as Prisma.InputJsonValue;

/** Concept opslaan: de live pagina verandert niet. */
export async function saveDraft(slug: string, full: Resolved<Record<string, BlockDef>>, by: string) {
  const def = ALL_DEFS[slug];
  const draft = diffPage(def, resolvePage(def, diffPage(def, full)));
  await prisma.sitePage.upsert({
    where: { slug },
    create: { slug, draft: json(draft), updatedBy: by },
    update: { draft: json(draft), updatedBy: by },
  });
}

/** Publiceren: het concept wordt de live inhoud. */
export async function publish(slug: string, full: Resolved<Record<string, BlockDef>>, by: string) {
  const def = ALL_DEFS[slug];
  const content = diffPage(def, resolvePage(def, diffPage(def, full)));
  const data = { content: json(content), draft: Prisma.DbNull, updatedBy: by, publishedAt: new Date() };
  await prisma.sitePage.upsert({ where: { slug }, create: { slug, ...data }, update: data });
}

/** Concept weggooien: terug naar wat live staat. */
export async function discardDraft(slug: string) {
  await prisma.sitePage.updateMany({ where: { slug }, data: { draft: Prisma.DbNull } });
}

export async function setStatus(slug: string, status: PageStatus, by: string) {
  await prisma.sitePage.upsert({
    where: { slug },
    create: { slug, status, updatedBy: by },
    update: { status, updatedBy: by },
  });
}
