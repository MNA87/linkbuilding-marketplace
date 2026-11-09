import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, PencilLine, CircleCheck } from "lucide-react";
import { listPages } from "@/lib/cms/content";
import { seoScore } from "@/lib/cms/resolve";
import StatusToggle from "./StatusToggle";

export const metadata: Metadata = { title: "Pagina's" };

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })
    : null;

const DOT = { good: "bg-green-500", ok: "bg-amber-400", bad: "bg-red-500" } as const;
const DOT_TITLE = { good: "SEO-titel en -omschrijving hebben een goede lengte", ok: "SEO-titel of -omschrijving kan beter", bad: "SEO-titel of -omschrijving ontbreekt" } as const;

// De pagina's van publito.nl: wat live staat, wat concept is en hoe de SEO ervoor staat.
export default async function PagesOverview({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab;
  const tab = asked === "published" || asked === "draft" ? asked : "all";
  const pages = await listPages();
  const shown = pages.filter((p) => tab === "all" || p.status === tab);
  const tabs = [
    { key: "all", label: "Alle", count: pages.length, href: "/admin/site/paginas" },
    { key: "published", label: "Gepubliceerd", count: pages.filter((p) => p.status === "published").length, href: "/admin/site/paginas?tab=published" },
    { key: "draft", label: "Concept", count: pages.filter((p) => p.status === "draft").length, href: "/admin/site/paginas?tab=draft" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">Pagina&apos;s</h1>
        <span className="flex-1" />
        <a
          href="/?cms=preview"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-gray-50"
        >
          <ExternalLink size={15} /> Bekijk site
        </a>
      </div>

      <nav className="mt-4 flex gap-2" aria-label="Filter">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.href}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-inkSoft">
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3 w-[170px]">Status</th>
              <th className="px-4 py-3 w-[64px]">SEO</th>
              <th className="px-4 py-3 w-[220px]">Laatst gewijzigd</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const score = seoScore(p.seo);
              return (
                <tr key={p.slug} className="group border-b border-line/70 align-top last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/site/paginas/${p.slug}`} className="font-semibold text-ink hover:text-[var(--btn-pay-bg)]">
                      {p.title}
                    </Link>
                    {p.hasDraft && <span className="ml-2 text-xs text-amber-700">· niet-gepubliceerde wijzigingen</span>}
                    <div className="mt-0.5 text-xs text-inkSoft">publito.nl{p.path === "/" ? "" : p.path}</div>
                    <div className="mt-1.5 flex gap-2 text-xs text-inkSoft opacity-0 transition-opacity group-hover:opacity-100">
                      <Link href={`/admin/site/paginas/${p.slug}`} className="text-[var(--btn-pay-bg)] hover:underline">
                        Bewerken
                      </Link>
                      <span>|</span>
                      <a href={`${p.path}?cms=preview`} target="_blank" rel="noreferrer" className="text-[var(--btn-pay-bg)] hover:underline">
                        Bekijken
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {p.status === "published" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        <CircleCheck size={13} /> Gepubliceerd
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        <PencilLine size={13} /> Concept
                      </span>
                    )}
                    <div className="mt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <StatusToggle slug={p.slug} status={p.status} canUnpublish={p.slug !== "home"} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[score]}`} title={DOT_TITLE[score]} />
                  </td>
                  <td className="px-4 py-3.5 text-inkSoft">
                    {fmt(p.updatedAt) ?? <span className="text-gray-400">standaardtekst</span>}
                    {p.updatedBy && <div className="text-xs">door {p.updatedBy}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-inkSoft">
        Een pagina in <b>Concept</b> is niet zichtbaar op publito.nl. Wijzigingen in de editor staan pas live als je op <b>Bijwerken</b> klikt.
      </p>
    </div>
  );
}
