import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type IncomingCategory = { wpTermId: number; name: string };

// Called BY a site's own WordPress install (see wordpress-plugin/nugevonden-wp-sync.php)
// on every sync cycle, reporting its own categories (a local get_categories()
// call on its side, no HTTP needed) so admin never has to type in category
// IDs by hand — see the "Ik ga niet zelf van te voren de categorieen
// invoeren" feedback that led to this. Authenticated with the site's own
// wpSyncSecret, same as /api/wp-sync/pending.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : null;
  const rawCategories = body?.categories;
  if (!secret || !Array.isArray(rawCategories)) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }

  const website = await prisma.website.findUnique({ where: { wpSyncSecret: secret } });
  if (!website) {
    return NextResponse.json({ error: "Ongeldige sleutel" }, { status: 403 });
  }

  const categories: IncomingCategory[] = [];
  for (const entry of rawCategories) {
    if (!entry || typeof entry !== "object") continue;
    const wpTermId = Number((entry as Record<string, unknown>).id);
    const name = String((entry as Record<string, unknown>).name ?? "").trim();
    if (!Number.isInteger(wpTermId) || wpTermId <= 0 || !name) continue;
    categories.push({ wpTermId, name: name.slice(0, 100) });
  }

  const incomingTermIds = categories.map((c) => c.wpTermId);

  await prisma.$transaction([
    prisma.wpCategory.deleteMany({
      where: { websiteId: website.id, wpTermId: { notIn: incomingTermIds } },
    }),
    ...categories.map((c) =>
      prisma.wpCategory.upsert({
        where: { websiteId_wpTermId: { websiteId: website.id, wpTermId: c.wpTermId } },
        create: { websiteId: website.id, wpTermId: c.wpTermId, name: c.name },
        update: { name: c.name },
      })
    ),
    prisma.website.update({ where: { id: website.id }, data: { wpCategoriesSyncedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, count: categories.length });
}
