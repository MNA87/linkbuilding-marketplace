import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, PencilLine } from "lucide-react";
import { listPostsAdmin } from "@/lib/cms/blogContent";
import { postSeo } from "@/lib/cms/blog";
import { seoScore } from "@/lib/cms/resolve";
import { NewPostButton, DeletePostLink } from "./ListControls";

export const metadata: Metadata = { title: "Blog" };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }) : "—";
const DOT = { good: "bg-green-500", ok: "bg-amber-400", bad: "bg-red-500" } as const;

export default async function BlogAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab: asked, q = "" } = await searchParams;
  const tab = asked === "published" || asked === "draft" ? asked : "all";
  const posts = await listPostsAdmin();
  const needle = q.trim().toLowerCase();
  const shown = posts.filter((p) => (tab === "all" || p.status === tab) && (!needle || p.title.toLowerCase().includes(needle)));
  const tabs = [
    { key: "all", label: "Alle", count: posts.length },
    { key: "published", label: "Gepubliceerd", count: posts.filter((p) => p.status === "published").length },
    { key: "draft", label: "Concept", count: posts.filter((p) => p.status === "draft").length },
  ];
  const now = Date.now();

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">Blog</h1>
        <NewPostButton />
        <span className="flex-1" />
        <a href="/blog" target="_blank" rel="noreferrer" className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-gray-50">
          Bekijk blog
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <nav className="flex gap-2" aria-label="Filter">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/admin/site/blog${t.key === "all" ? "" : `?tab=${t.key}`}${needle ? `${t.key === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]" : "border-line bg-surface text-ink/80 hover:bg-gray-50"
                }`}
              >
                {t.label}
                <span className={`tabular-nums ${active ? "" : "text-inkSoft"}`}>{t.count}</span>
              </Link>
            );
          })}
        </nav>
        <form className="ml-auto" action="/admin/site/blog">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <input name="q" defaultValue={q} placeholder="Berichten zoeken…" className="w-56 rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-[var(--btn-pay-bg)]" />
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-inkSoft">
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3 w-[180px]">Categorie</th>
              <th className="px-4 py-3 w-[150px]">Status</th>
              <th className="px-4 py-3 w-[60px]">SEO</th>
              <th className="px-4 py-3 w-[190px]">Datum</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-inkSoft">
                  {posts.length === 0 ? "Nog geen berichten. Klik op Nieuw bericht om te beginnen." : "Geen berichten gevonden."}
                </td>
              </tr>
            )}
            {shown.map((p) => {
              const score = seoScore({ ...postSeo(p), keyword: "" });
              const scheduled = p.status === "published" && p.publishedAt && Date.parse(p.publishedAt) > now;
              return (
                <tr key={p.id} className="group border-b border-line/70 align-top last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/site/blog/${p.id}`} className="font-semibold text-ink hover:text-[var(--btn-pay-bg)]">
                      {p.title || <span className="text-inkSoft">(zonder titel)</span>}
                    </Link>
                    {p.hasDraft && <span className="ml-2 text-xs text-amber-700">· niet-gepubliceerde wijzigingen</span>}
                    <div className="mt-0.5 text-xs text-inkSoft">publito.nl/blog/{p.slug}</div>
                    <div className="mt-1.5 flex gap-2 text-xs text-inkSoft opacity-0 transition-opacity group-hover:opacity-100">
                      <Link href={`/admin/site/blog/${p.id}`} className="text-[var(--btn-pay-bg)] hover:underline">
                        Bewerken
                      </Link>
                      <span>|</span>
                      <a href={`/blog/${p.slug}?cms=preview`} target="_blank" rel="noreferrer" className="text-[var(--btn-pay-bg)] hover:underline">
                        Bekijken
                      </a>
                      <span>|</span>
                      <DeletePostLink id={p.id} title={p.title} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-inkSoft">{p.categories.map((c) => c.name).join(", ") || "—"}</td>
                  <td className="px-4 py-3.5">
                    {scheduled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                        <Clock size={13} /> Ingepland
                      </span>
                    ) : p.status === "published" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        <CircleCheck size={13} /> Gepubliceerd
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        <PencilLine size={13} /> Concept
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[score]}`} />
                  </td>
                  <td className="px-4 py-3.5 text-inkSoft">
                    {p.status === "published" ? fmt(p.publishedAt) : fmt(p.updatedAt)}
                    <div className="text-xs">{p.status === "published" ? "gepubliceerd" : "laatst bewerkt"}{p.updatedBy ? ` · ${p.updatedBy}` : ""}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
