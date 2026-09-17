import { NextResponse } from "next/server";
import { Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type IncomingCategory = { wpTermId: number; name: string };

function parseCategories(raw: unknown): IncomingCategory[] {
  const categories: IncomingCategory[] = [];
  if (!Array.isArray(raw)) return categories;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const wpTermId = Number((entry as Record<string, unknown>).id);
    const name = String((entry as Record<string, unknown>).name ?? "").trim();
    if (!Number.isInteger(wpTermId) || wpTermId <= 0 || !name) continue;
    categories.push({ wpTermId, name: name.slice(0, 100) });
  }
  return categories;
}

// Blog categories and homepage-link rubrieken are two separate lists (see
// WpCategory.kind) — a startpagina rubriek like "SEO" has nothing to do
// with how the blog itself is organized, so they're kept, synced and
// pruned independently even though they land in the same table.
function syncKind(websiteId: string, kind: ProductType, categories: IncomingCategory[]) {
  const incomingTermIds = categories.map((c) => c.wpTermId);
  return [
    prisma.wpCategory.deleteMany({
      where: { websiteId, kind, wpTermId: { notIn: incomingTermIds } },
    }),
    ...categories.map((c) =>
      prisma.wpCategory.upsert({
        where: { websiteId_wpTermId_kind: { websiteId, wpTermId: c.wpTermId, kind } },
        create: { websiteId, wpTermId: c.wpTermId, name: c.name, kind },
        update: { name: c.name },
      })
    ),
  ];
}

// Called BY a site's own WordPress install (see wordpress-plugin/nugevonden-wp-sync.php)
// on every sync cycle, reporting its own categories (a local get_categories()
// call on its side, no HTTP needed) so admin never has to type in category
// IDs by hand — see the "Ik ga niet zelf van te voren de categorieen
// invoeren" feedback that led to this. Authenticated with the site's own
// wpSyncSecret, same as /api/wp-sync/pending.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : null;
  if (!secret || (!Array.isArray(body?.categories) && !Array.isArray(body?.linkCategories))) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }

  const website = await prisma.website.findUnique({ where: { wpSyncSecret: secret } });
  if (!website) {
    return NextResponse.json({ error: "Ongeldige sleutel" }, { status: 403 });
  }

  const categories = parseCategories(body.categories);
  const linkCategories = parseCategories(body.linkCategories);

  const operations: Prisma.PrismaPromise<unknown>[] = [
    ...syncKind(website.id, "BLOG_POST", categories),
    ...syncKind(website.id, "HOMEPAGE_LINK", linkCategories),
    prisma.website.update({ where: { id: website.id }, data: { wpCategoriesSyncedAt: new Date() } }),
  ];
  await prisma.$transaction(operations);

  return NextResponse.json({ ok: true, count: categories.length, linkCount: linkCategories.length });
}
