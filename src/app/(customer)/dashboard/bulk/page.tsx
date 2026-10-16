import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import BulkOrder, { type BulkSite, type BulkProject } from "./BulkOrder";

export const metadata: Metadata = { title: "Bulk bestellen" };

// The agency bulk-order flow: pick articles per site, assign each to a project
// (the agency's own client), and place them in one go — on account, onto the
// monthly verzamelfactuur. Only for a customer whose company has bulk-besteller
// turned on (Admin → Klanten → klant). See docs/nice-to-have/agency-module.md.
export default async function BulkOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { bulkOrdering: true },
  });

  if (!company?.bulkOrdering) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-serif text-2xl text-ink">Bulk bestellen</h1>
        <div className="mt-4 rounded-xl border border-line bg-surface p-6 text-sm text-inkSoft">
          Bulk bestellen staat niet aan voor dit account. Neem contact met ons op als je als bureau meerdere links tegelijk
          wilt bestellen.
        </div>
      </div>
    );
  }

  const [projects, websites] = await Promise.all([
    prisma.project.findMany({
      where: { customerCompanyId: session.user.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true, product: { type: "BLOG_POST" } } } },
      include: {
        category: { select: { name: true } },
        country: { select: { name: true } },
        metrics: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { domainRating: true, domainAuthority: true, organicTraffic: true },
        },
        websiteProducts: {
          where: { isAvailable: true, product: { type: "BLOG_POST" } },
          select: { id: true, config: true, periodic: true },
          take: 1,
        },
      },
      orderBy: { domain: "asc" },
    }),
  ]);

  // Build the orderable list, pricing each site for this customer. A site whose
  // price can't be determined is left out (it can't be ordered).
  const sites: BulkSite[] = [];
  for (const w of websites) {
    const wp = w.websiteProducts[0];
    if (!wp) continue;
    let price: number;
    try {
      price = Number((await computePriceForWebsiteProduct(wp.id, session.user.companyId)).customerPrice);
    } catch {
      continue;
    }
    const config = wp.config as { maxLinks?: unknown };
    const maxLinks = w.maxLinks ?? (typeof config.maxLinks === "number" ? config.maxLinks : 1);
    const m = w.metrics[0];
    sites.push({
      id: wp.id,
      domain: w.domain,
      niche: w.category?.name ?? "—",
      country: w.country?.name ?? "—",
      dr: m?.domainRating ?? null,
      da: m?.domainAuthority ?? null,
      traffic: m?.organicTraffic ?? null,
      maxLinks: Math.max(1, maxLinks),
      periodic: wp.periodic,
      price,
    });
  }

  const projectList: BulkProject[] = projects.map((p) => ({ id: p.id, name: p.name }));

  return <BulkOrder sites={sites} projects={projectList} />;
}
