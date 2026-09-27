import type { Metadata } from "next";
import Link from "next/link";
import type { WebsiteStatus } from "@prisma/client";
import { ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentPage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = { title: "Websites" };

const PER_PAGE = 20;

const STATUSES: { key: WebsiteStatus; label: string; style: string }[] = [
  { key: "SUBMITTED", label: "In beoordeling", style: "bg-amber-50 text-amber-800" },
  { key: "APPROVED", label: "Goedgekeurd", style: "bg-blue-50 text-blue-700" },
  { key: "ACTIVE", label: "Actief", style: "bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" },
  { key: "PAUSED", label: "Gepauzeerd", style: "bg-gray-100 text-ink/70" },
  { key: "REJECTED", label: "Afgewezen", style: "bg-red-50 text-red-700" },
];

// Same layout as Mijn orders: the whole row opens the website.
const COLUMNS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_56px_132px_56px]";

export default async function AdminWebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s.key === params.status)?.key;

  const [groups, websites] = await Promise.all([
    prisma.website.groupBy({ by: ["status"], _count: true }),
    prisma.website.findMany({
      where: status ? { status } : undefined,
      include: { company: true, category: true, metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const counts = new Map(groups.map((g) => [g.status, g._count]));
  const all = groups.reduce((sum, g) => sum + g._count, 0);

  const page = currentPage(params.pagina, Math.ceil(websites.length / PER_PAGE));
  const shown = websites.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const listHref = (key?: string, pagina?: number) => {
    const q = new URLSearchParams();
    if (key) q.set("status", key);
    if (pagina && pagina > 1) q.set("pagina", String(pagina));
    const s = q.toString();
    return s ? `/admin/websites?${s}` : "/admin/websites";
  };

  const tabs = [{ key: undefined, label: "Alle", count: all }, ...STATUSES.map((s) => ({ ...s, count: counts.get(s.key) ?? 0 }))];

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Websites</h1>
          <p className="mt-1 text-sm text-inkSoft">{all === 1 ? "1 website" : `${all} websites`}</p>
        </div>
        <Link
          href="/admin/websites/new"
          className="btn-pay inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
        >
          <Plus size={16} /> Nieuwe website
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter op status">
        {tabs.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key ?? "alle"}
              href={listHref(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`tabular-nums ${active ? "" : "text-inkSoft"}`}>{t.count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {shown.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <span>Domein</span>
            <span>Publisher</span>
            <span>Categorie</span>
            <span>DR</span>
            <span>Status</span>
            <span className="text-right">Details</span>
          </div>
        )}

        {shown.map((w) => {
          const s = STATUSES.find((x) => x.key === w.status);
          return (
            <div
              key={w.id}
              className={`group relative grid grid-cols-[minmax(0,1fr)_auto] ${COLUMNS} items-center gap-x-4 gap-y-1 border-t border-line/70 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-gray-50/70 sm:px-5`}
            >
              <Link href={`/admin/websites/${w.id}`} className="absolute inset-0" aria-label={`${w.domain} beheren`} />
              <span className="truncate text-sm text-ink">{w.domain}</span>
              <span className="col-span-2 row-start-2 truncate text-sm text-ink/80 md:col-span-1 md:row-start-auto">
                {w.company.name}
                <span className="text-inkSoft md:hidden"> · {w.category.name}</span>
              </span>
              <span className="hidden truncate text-sm text-ink/80 md:block">{w.category.name}</span>
              <span className="hidden text-sm tabular-nums text-ink/80 md:block">{w.metrics[0]?.domainRating ?? "–"}</span>
              <div className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
                <span className={`inline-flex w-[116px] items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s?.style ?? ""}`}>
                  {s?.label ?? w.status}
                </span>
              </div>
              <span className="hidden justify-self-end md:block">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white">
                  <ChevronRight size={16} />
                </span>
              </span>
            </div>
          );
        })}

        {shown.length === 0 && <div className="px-5 py-10 text-center text-sm text-inkSoft">Geen websites gevonden.</div>}
      </div>

      <Pagination page={page} perPage={PER_PAGE} total={websites.length} noun="websites" href={(n) => listHref(status, n)} />
    </div>
  );
}
