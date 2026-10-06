import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PRODUCT_TYPES } from "@/lib/websiteProducts";
import StatusActions from "./StatusActions";
import DeleteWebsiteButton from "./DeleteWebsiteButton";
import WordpressConnectionSection from "./WordpressConnectionSection";
import WpCategoriesSection from "./WpCategoriesSection";
import DetailsTab from "./DetailsTab";
import PricesTab from "./PricesTab";
import type { PriceColumnState } from "../WebsiteFields";

const STATUS: Record<string, { label: string; style: string }> = {
  SUBMITTED: { label: "In beoordeling", style: "bg-amber-50 text-amber-800" },
  APPROVED: { label: "Goedgekeurd", style: "bg-blue-50 text-blue-700" },
  ACTIVE: { label: "Actief", style: "bg-emerald-50 text-emerald-700" },
  PAUSED: { label: "Gepauzeerd", style: "bg-gray-100 text-ink/70" },
  REJECTED: { label: "Afgewezen", style: "bg-red-50 text-red-700" },
};

const TABS = [
  { key: "gegevens", label: "Gegevens" },
  { key: "prijzen", label: "Prijzen" },
  { key: "wordpress", label: "WordPress" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const website = await prisma.website.findUnique({ where: { id }, select: { domain: true } });
  return { title: website?.domain ?? "Website" };
}

const SITE_INCLUDE = {
  company: true,
  category: true,
  niches: { select: { id: true } },
  country: true,
  metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
  websiteProducts: { include: { product: true, topicPrices: true } },
  wpCategories: { orderBy: { name: "asc" } },
} satisfies Prisma.WebsiteInclude;

const nl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("nl-NL"));
const plain = (n: { toFixed: (d: number) => string }) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

// One website in the admin: a short summary on top, and tabs for its
// details, prices per topic, figures and WordPress connection.
export default async function AdminWebsiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "gegevens";

  const website = await prisma.website.findUnique({ where: { id }, include: SITE_INCLUDE });
  if (!website) notFound();
  const metric = website.metrics[0];

  const offered = website.websiteProducts.filter((wp) => wp.isAvailable);
  const summary = [
    website.category.name,
    website.country.name,
    // The figures in short; they're fetched and kept up to date automatically.
    metric
      ? `DR ${metric.domainRating} · DA ${metric.domainAuthority} · ${nl(metric.organicTraffic)} bezoekers/mnd`
      : null,
    ...offered.map((wp) => `${wp.product.name} €${plain(wp.supplierPrice)}${wp.periodic ? "/jaar" : ""}`),
  ].filter(Boolean);

  return (
    <div className="max-w-5xl">
      <Link href="/admin/websites" className="text-sm text-inkSoft hover:text-ink">
        ← Websites
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">{website.domain}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[website.status]?.style ?? ""}`}>
              {STATUS[website.status]?.label ?? website.status}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-inkSoft">
            {summary.join(" · ")}
            <a
              href={`https://${website.domain}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`${website.domain} bekijken`}
              className="hover:text-ink"
            >
              <ExternalLink size={13} />
            </a>
          </p>
        </div>
        <StatusActions websiteId={website.id} currentStatus={website.status} />
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/websites/${website.id}${t.key === "gegevens" ? "" : `?tab=${t.key}`}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
              t.key === tab
                ? "border-[var(--btn-pay-bg)] font-semibold text-ink"
                : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "gegevens" && <DetailsPanel website={website} />}
        {tab === "prijzen" && <PricesPanel website={website} />}
        {tab === "wordpress" && (
          <div className="space-y-5">
            <WordpressConnectionSection
              websiteId={website.id}
              connected={Boolean(website.wordpressUrl && website.wordpressUsername && website.wordpressAppPassword)}
              wordpressUrl={website.wordpressUrl}
              wordpressUsername={website.wordpressUsername}
              syncActive={Boolean(website.wpSyncSecret)}
            />
            <WpCategoriesSection
              blogCategories={website.wpCategories.filter((c) => c.kind === "BLOG_POST")}
              linkCategories={website.wpCategories.filter((c) => c.kind === "HOMEPAGE_LINK")}
              syncedAt={website.wpCategoriesSyncedAt}
              syncActive={Boolean(website.wpSyncSecret)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

type Site = Prisma.WebsiteGetPayload<{ include: typeof SITE_INCLUDE }>;

async function DetailsPanel({ website }: { website: Site }) {
  const [countries, languages, niches] = await Promise.all([
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <DetailsTab
        websiteId={website.id}
        initial={{
          domain: website.domain,
          description: website.description ?? "",
          countryId: website.countryId,
          languageId: website.languageId,
          nicheIds: [website.categoryId, ...website.niches.map((n) => n.id).filter((n) => n !== website.categoryId)],
          maxLinks: website.maxLinks?.toString() ?? "",
          sponsored: website.sponsored,
          exampleUrl: website.exampleUrl ?? "",
        }}
        countries={countries}
        languages={languages}
        niches={niches}
      />
      <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50/40 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-ink">Website verwijderen</div>
          <p className="text-xs text-inkSoft">Kan alleen als er nog geen orders voor deze website zijn.</p>
        </div>
        <DeleteWebsiteButton websiteId={website.id} domain={website.domain} />
      </div>
    </>
  );
}

async function PricesPanel({ website }: { website: Site }) {
  const topics = await prisma.topic.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const columns: PriceColumnState[] = PRODUCT_TYPES.map((type) => {
    const wp = website.websiteProducts.find((p) => p.product.type === type);
    return {
      type,
      enabled: Boolean(wp?.isAvailable),
      // A new product follows the usual kind: homepage links per year.
      periodic: wp ? wp.periodic : type === "HOMEPAGE_LINK",
      prices: Object.fromEntries([
        ["", wp ? plain(wp.supplierPrice) : ""],
        ...topics.map((t) => {
          const p = wp?.topicPrices.find((tp) => tp.topicId === t.id);
          return [t.id, p ? plain(p.price) : ""];
        }),
      ]),
    };
  });
  return <PricesTab websiteId={website.id} initial={columns} topics={topics} />;
}
