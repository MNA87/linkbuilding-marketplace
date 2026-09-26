import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusActions from "./StatusActions";
import AddProductForm from "./AddProductForm";
import ToggleAvailabilityButton from "./ToggleAvailabilityButton";
import EditPriceField from "./EditPriceField";
import EditWebsiteSection from "./EditWebsiteSection";
import RefreshMetricsButton from "./RefreshMetricsButton";
import { cBlock } from "@/lib/websiteMetrics";
import DeleteWebsiteButton from "./DeleteWebsiteButton";
import WordpressConnectionSection from "./WordpressConnectionSection";
import WpCategoriesSection from "./WpCategoriesSection";

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

const nl = (n: number | null) => (n == null ? "—" : n.toLocaleString("nl-NL"));

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
      wpCategories: { orderBy: { name: "asc" } },
    },
  });
  const blogCategories = website?.wpCategories.filter((c) => c.kind === "BLOG_POST") ?? [];
  const linkCategories = website?.wpCategories.filter((c) => c.kind === "HOMEPAGE_LINK") ?? [];

  if (!website) notFound();

  const existingProductTypes = website.websiteProducts.map((wp) => wp.product.type);

  // Other sites on the same C-class network (Cloudflare addresses say nothing
  // about the server, so those are left out).
  const metric = website.metrics[0];
  const block = metric?.ipAddress ? cBlock(metric.ipAddress) : null;
  const sameBlockCandidates =
    block && !metric?.behindCloudflare
      ? await prisma.website.findMany({
          where: { id: { not: website.id }, metrics: { some: { ipAddress: { startsWith: `${block}.` } } } },
          select: { domain: true, metrics: { orderBy: { fetchedAt: "desc" }, take: 1, select: { ipAddress: true } } },
        })
      : [];
  const sameBlock = sameBlockCandidates
    .filter((w) => w.metrics[0]?.ipAddress && cBlock(w.metrics[0].ipAddress) === block)
    .map((w) => w.domain);

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-ink">Cijfers</h2>
            <p className="text-xs text-inkSoft mt-0.5">
              {metric
                ? metric.source === "auto"
                  ? "Automatisch opgehaald"
                  : "Handmatig ingevuld · nog niet automatisch opgehaald"
                : "Nog geen cijfers."}
            </p>
          </div>
          <RefreshMetricsButton websiteId={website.id} />
        </div>
        {metric && (
          <>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Domain Rating", value: nl(metric.domainRating), from: "Ahrefs" },
                { label: "Verkeer per maand", value: nl(metric.organicTraffic), from: "Ahrefs" },
                { label: "Verwijzende domeinen", value: nl(metric.referringDomains), from: "Ahrefs" },
                { label: "Domain Authority", value: nl(metric.domainAuthority), from: "Moz" },
                {
                  label: "Trust Flow / Citation Flow",
                  value: `${nl(metric.trustFlow)} / ${nl(metric.citationFlow)}`,
                  from: "Majestic",
                },
                {
                  label: "Spamscore",
                  value: metric.spamScore == null ? "—" : `${metric.spamScore}%`,
                  from: "Moz · alleen voor admin",
                },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border border-line px-3 py-2.5">
                  <div className="font-serif text-xl text-ink tabular-nums">{t.value}</div>
                  <div className="text-xs text-inkSoft">{t.label}</div>
                  <div className="text-[10px] text-inkSoft/70">{t.from}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3 text-sm">
              <span className="text-inkSoft">IP-adres</span>
              <span className="text-ink tabular-nums">
                {metric.ipAddress ?? "—"}
                {metric.behindCloudflare && <span className="ml-2 text-xs text-inkSoft">via Cloudflare</span>}
                {block && !metric.behindCloudflare && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-inkSoft">C-blok {block}</span>
                )}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-2 text-sm">
              <span className="text-inkSoft">AI-Cited (Google AI Overviews / AI Mode)</span>
              <span className="text-ink">
                {metric.aiCited === null ? "—" : metric.aiCited ? "Ja" : "Nee"}
                <span className="ml-2 text-[10px] text-inkSoft/70">Ahrefs Brand Radar</span>
              </span>
            </div>
            {sameBlock.length > 0 && (
              <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
                {sameBlock.length === 1 ? "Nog 1 website staat" : `Nog ${sameBlock.length} websites staan`} in hetzelfde
                C-blok: {sameBlock.join(", ")}
              </p>
            )}
          </>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg p-4 mb-6">
        <h2 className="font-medium text-ink mb-3">Producten & prijzen</h2>
        <div className="space-y-2">
          {website.websiteProducts.map((wp) => (
            <div key={wp.id} className="flex items-center justify-between border border-line rounded-md px-3 py-2">
              <div>
                <div className="text-sm text-ink font-medium">{wp.product.name}</div>
                <EditPriceField websiteProductId={wp.id} supplierPrice={wp.supplierPrice.toNumber()} />
              </div>
              <ToggleAvailabilityButton websiteProductId={wp.id} isAvailable={wp.isAvailable} />
            </div>
          ))}
          {website.websiteProducts.length === 0 && <p className="text-sm text-inkSoft">Nog geen producten.</p>}
        </div>
      </div>

      {(["BLOG_POST", "HOMEPAGE_LINK"] as const).some((t) => !existingProductTypes.includes(t)) && (
        <div className="bg-surface border border-line rounded-lg p-4 mb-6">
          <h2 className="font-medium text-ink mb-3">Product toevoegen</h2>
          <AddProductForm websiteId={website.id} existingProductTypes={existingProductTypes} />
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-4 mb-6">
        <h2 className="font-medium text-ink mb-3">Actie</h2>
        <StatusActions websiteId={website.id} currentStatus={website.status} />
      </div>

      <WordpressConnectionSection
        websiteId={website.id}
        connected={Boolean(website.wordpressUrl && website.wordpressUsername && website.wordpressAppPassword)}
        wordpressUrl={website.wordpressUrl}
        wordpressUsername={website.wordpressUsername}
        syncActive={Boolean(website.wpSyncSecret)}
      />

      <WpCategoriesSection
        blogCategories={blogCategories}
        linkCategories={linkCategories}
        syncedAt={website.wpCategoriesSyncedAt}
        syncActive={Boolean(website.wpSyncSecret)}
      />

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

      <div className="mt-6 pt-6 border-t border-line">
        <DeleteWebsiteButton websiteId={website.id} domain={website.domain} />
      </div>
    </div>
  );
}
