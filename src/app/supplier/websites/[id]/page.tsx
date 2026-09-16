import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddProductForm from "./AddProductForm";
import ToggleAvailabilityButton from "./ToggleAvailabilityButton";
import EditWebsiteSection from "./EditWebsiteSection";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "In beoordeling",
  APPROVED: "Goedgekeurd",
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  REJECTED: "Afgewezen",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const website = await prisma.website.findUnique({ where: { id }, select: { domain: true } });
  return { title: website?.domain ?? "Website" };
}

export default async function SupplierWebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) redirect("/login");

  const website = await prisma.website.findUnique({
    where: { id },
    include: {
      category: true,
      country: true,
      language: true,
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
      websiteProducts: { include: { product: true } },
    },
  });

  if (!website || website.companyId !== session.user.companyId) notFound();

  const existingProductTypes = website.websiteProducts.map((wp) => wp.product.type);

  const [categories, countries, languages] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-serif text-2xl text-ink">{website.domain}</h1>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brandSoft text-brand">
          {STATUS_LABELS[website.status]}
        </span>
      </div>
      <p className="text-sm text-inkSoft mb-6">
        {website.category.name} &middot; {website.country.name} / {website.language.name}
      </p>

      {website.status === "REJECTED" && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          Deze website is afgewezen door het platform.
        </div>
      )}
      {website.status === "SUBMITTED" && (
        <div className="mb-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Nog in beoordeling — zodra goedgekeurd verschijnt de website in de marketplace.
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-4 mb-6">
        <h2 className="font-medium text-ink mb-2">Metrics</h2>
        {website.metrics[0] ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-inkSoft text-xs">DR</div>
              <div className="text-ink font-medium">{website.metrics[0].domainRating}</div>
            </div>
            <div>
              <div className="text-inkSoft text-xs">DA</div>
              <div className="text-ink font-medium">{website.metrics[0].domainAuthority}</div>
            </div>
            <div>
              <div className="text-inkSoft text-xs">Verkeer</div>
              <div className="text-ink font-medium">{website.metrics[0].organicTraffic}</div>
            </div>
            <div>
              <div className="text-inkSoft text-xs">Ref. domains</div>
              <div className="text-ink font-medium">{website.metrics[0].referringDomains}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-inkSoft">Geen metrics bekend.</p>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg p-4 mb-6">
        <h2 className="font-medium text-ink mb-3">Producten & prijzen</h2>
        <div className="space-y-2">
          {website.websiteProducts.map((wp) => (
            <div key={wp.id} className="flex items-center justify-between border border-line rounded-md px-3 py-2">
              <div>
                <div className="text-sm text-ink font-medium">{wp.product.name}</div>
                <div className="text-xs text-inkSoft">&euro;{wp.supplierPrice.toFixed(2)}</div>
              </div>
              <ToggleAvailabilityButton websiteProductId={wp.id} isAvailable={wp.isAvailable} />
            </div>
          ))}
          {website.websiteProducts.length === 0 && (
            <p className="text-sm text-inkSoft">Nog geen producten.</p>
          )}
        </div>
      </div>

      {(["BLOG_POST", "HOMEPAGE_LINK"] as const).some((t) => !existingProductTypes.includes(t)) && (
        <div className="bg-surface border border-line rounded-lg p-4 mb-6">
          <h2 className="font-medium text-ink mb-3">Product toevoegen</h2>
          <AddProductForm websiteId={website.id} existingProductTypes={existingProductTypes} />
        </div>
      )}

      <EditWebsiteSection
        website={{
          id: website.id,
          domain: website.domain,
          description: website.description ?? "",
          categoryId: website.categoryId,
          countryId: website.countryId,
          languageId: website.languageId,
          domainRating: website.metrics[0]?.domainRating ?? 0,
          domainAuthority: website.metrics[0]?.domainAuthority ?? 0,
          organicTraffic: website.metrics[0]?.organicTraffic ?? 0,
          referringDomains: website.metrics[0]?.referringDomains ?? 0,
        }}
        categories={categories}
        countries={countries}
        languages={languages}
      />
    </div>
  );
}
