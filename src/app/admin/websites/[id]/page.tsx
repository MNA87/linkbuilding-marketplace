import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusActions from "./StatusActions";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "In beoordeling",
  APPROVED: "Goedgekeurd",
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  REJECTED: "Afgewezen",
};

export default async function AdminWebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const website = await prisma.website.findUnique({
    where: { id },
    include: {
      company: true,
      category: true,
      country: true,
      language: true,
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
      websiteProducts: { include: { product: true } },
    },
  });

  if (!website) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-serif text-2xl text-ink">{website.domain}</h1>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brandSoft text-brand">
          {STATUS_LABELS[website.status]}
        </span>
      </div>
      <p className="text-sm text-inkSoft mb-6">
        Publisher: {website.company.name} &middot; {website.category.name} &middot; {website.country.name} /{" "}
        {website.language.name}
      </p>

      {website.description && (
        <div className="bg-surface border border-line rounded-lg p-4 mb-6">
          <h2 className="font-medium text-ink mb-2">Omschrijving</h2>
          <p className="text-sm text-inkSoft">{website.description}</p>
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
        <h2 className="font-medium text-ink mb-3">Producten</h2>
        <div className="space-y-2">
          {website.websiteProducts.map((wp) => (
            <div key={wp.id} className="flex items-center justify-between border border-line rounded-md px-3 py-2">
              <div className="text-sm text-ink">{wp.product.name}</div>
              <div className="text-sm text-inkSoft">&euro;{wp.supplierPrice.toFixed(2)}</div>
            </div>
          ))}
          {website.websiteProducts.length === 0 && <p className="text-sm text-inkSoft">Nog geen producten.</p>}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-4">
        <h2 className="font-medium text-ink mb-3">Actie</h2>
        <StatusActions websiteId={website.id} currentStatus={website.status} />
      </div>
    </div>
  );
}
