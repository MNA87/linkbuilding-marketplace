import type { Metadata } from "next";
import Link from "next/link";
import type { WebsiteStatus } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentPage } from "@/lib/pagination";
import { missingDetails } from "@/lib/websiteCompleteness";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = { title: "Websites" };

const PER_PAGE = 25;

const STATUSES: { key: WebsiteStatus; label: string; style: string }[] = [
  { key: "ACTIVE", label: "Actief", style: "bg-emerald-50 text-emerald-700" },
  { key: "PAUSED", label: "Gepauzeerd", style: "bg-gray-100 text-ink/70" },
  { key: "SUBMITTED", label: "In beoordeling", style: "bg-amber-50 text-amber-800" },
  { key: "APPROVED", label: "Goedgekeurd", style: "bg-blue-50 text-blue-700" },
  { key: "REJECTED", label: "Afgewezen", style: "bg-red-50 text-red-700" },
];
const SAGE = "bg-[#eff3f0] text-[#5b7266]";
const plain = (n: { toFixed: (d: number) => string }) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

// All websites at a glance: niches, DR, price, the topics placed, duration,
// status — and what a site still misses, so nothing is forgotten.
export default async function AdminWebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const filter = params.status === "mist" ? "mist" : STATUSES.find((s) => s.key === params.status)?.key;

  const websites = await prisma.website.findMany({
    include: {
      category: { select: { name: true } },
      niches: { select: { id: true, name: true } },
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1, select: { domainRating: true } },
      websiteProducts: {
        include: {
          product: { select: { type: true, name: true } },
          topicPrices: { include: { topic: { select: { name: true, sortOrder: true } } } },
        },
      },
    },
    orderBy: { domain: "asc" },
  });

  const rows = websites.map((w) => {
    const offered = w.websiteProducts.filter((wp) => wp.isAvailable);
    const topics = Array.from(
      new Map(offered.flatMap((wp) => wp.topicPrices.map((tp) => [tp.topic.name, tp.topic.sortOrder] as const)))
    )
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
    return {
      id: w.id,
      domain: w.domain,
      status: w.status,
      niches: [w.category.name, ...w.niches.map((n) => n.name).filter((n) => n !== w.category.name)],
      dr: w.metrics[0]?.domainRating ?? null,
      offered,
      topics,
      missing: missingDetails({
        maxLinks: w.maxLinks,
        exampleUrl: w.exampleUrl,
        hasMetrics: w.metrics.length > 0,
        offeredProducts: offered.length,
      }),
    };
  });

  const counts = {
    all: rows.length,
    mist: rows.filter((r) => r.missing.length > 0).length,
    ...Object.fromEntries(STATUSES.map((s) => [s.key, rows.filter((r) => r.status === s.key).length])),
  } as Record<string, number>;
  const filtered = rows.filter(
    (r) => (!q || r.domain.includes(q)) && (!filter || (filter === "mist" ? r.missing.length > 0 : r.status === filter))
  );
  const page = currentPage(params.pagina, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const listHref = (changes: { status?: string; pagina?: number }) => {
    const sp = new URLSearchParams();
    const status = "status" in changes ? changes.status : params.status;
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    if (changes.pagina && changes.pagina > 1) sp.set("pagina", String(changes.pagina));
    const s = sp.toString();
    return s ? `/admin/websites?${s}` : "/admin/websites";
  };
  const chips = [
    { key: undefined, label: "Alle", count: counts.all },
    ...STATUSES.filter((s) => counts[s.key] > 0 || s.key === "ACTIVE").map((s) => ({
      key: s.key as string,
      label: s.label,
      count: counts[s.key],
    })),
    { key: "mist", label: "Mist gegevens", count: counts.mist },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Websites</h1>
          <p className="mt-1 text-sm text-inkSoft">
            {counts.all === 1 ? "1 website" : `${counts.all} websites`}
            {counts.mist > 0 && ` · ${counts.mist} met ontbrekende gegevens`}
          </p>
        </div>
        <Link
          href="/admin/websites/new"
          className="btn-pay inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
        >
          <Plus size={16} /> Nieuwe website
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <form action="/admin/websites" className="mr-1">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <label className="flex h-10 w-72 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)]">
            <Search size={15} className="text-inkSoft" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Zoek op domein"
              aria-label="Zoek op domein"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
            />
          </label>
        </form>
        {chips.map((c) => {
          const active = c.key === filter || (!c.key && !filter);
          return (
            <Link
              key={c.key ?? "alle"}
              href={listHref({ status: c.key })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-[var(--btn-pay-bg)] font-semibold text-ink"
                  : c.key === "mist" && c.count > 0
                    ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-line bg-surface text-inkSoft hover:bg-gray-50"
              }`}
            >
              {c.label}
              <span className="tabular-nums opacity-80">{c.count}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-ink">
            <tr>
              <th className="px-4 py-3">Domein</th>
              <th className="px-4 py-3">Niches</th>
              <th className="px-4 py-3 text-right">DR</th>
              <th className="px-4 py-3">Prijs</th>
              <th className="px-4 py-3">Onderwerpen</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const s = STATUSES.find((x) => x.key === r.status);
              return (
                <tr key={r.id} className="group relative border-t border-line/70 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/websites/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.domain}
                    </Link>
                    {r.missing.length > 0 && (
                      <div className="mt-0.5 text-[11px] font-medium text-amber-700">● mist {r.missing.join(", ")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex flex-wrap gap-1">
                      {r.niches.slice(0, 2).map((n) => (
                        <span key={n} className={`rounded-full px-2 py-0.5 text-[11px] uppercase ${SAGE}`}>
                          {n}
                        </span>
                      ))}
                      {r.niches.length > 2 && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-inkSoft">
                          +{r.niches.length - 2}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.dr ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.offered.length === 0 ? (
                      <span className="text-inkSoft">—</span>
                    ) : (
                      r.offered.map((wp) => (
                        <div key={wp.id} className="whitespace-nowrap">
                          <span className="font-semibold tabular-nums text-ink">€{plain(wp.supplierPrice)}</span>
                          <span className="text-xs text-inkSoft">
                            {" "}
                            {wp.product.type === "HOMEPAGE_LINK" ? "homepage" : "blog"}
                            {wp.periodic ? " · per jaar" : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/80">
                    {r.topics.length > 0 ? r.topics.join(", ") : <span className="text-inkSoft">Alleen Algemeen</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s?.style ?? ""}`}
                    >
                      {s?.label ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/websites/${r.id}`}
                      className="whitespace-nowrap text-[13px] font-medium text-[var(--btn-pay-bg)] hover:underline"
                    >
                      Bewerken →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-inkSoft">
                  Geen websites gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        perPage={PER_PAGE}
        total={filtered.length}
        noun="websites"
        href={(n) => listHref({ pagina: n })}
      />
    </div>
  );
}
