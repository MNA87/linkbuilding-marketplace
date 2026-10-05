import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LAUNCH_STEPS, currentStep, launchPercent } from "@/lib/launch";
import { AddLaunchItem, LaunchDate, LaunchItemRow } from "./LaunchControls";

export const metadata: Metadata = { title: "Planning" };

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

// What's left before going live, in four steps, and the ideas for after.
export default async function AdminLaunchPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab;
  const tab = asked === "nice" || asked === "algemeen" ? asked : "livegang";
  const [items, settings] = await Promise.all([
    prisma.launchItem.findMany({ orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] }),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { launchDate: true } }),
  ]);
  const live = items.filter((i) => i.list === "livegang");
  const nice = items.filter((i) => i.list === "nice");
  // Your own to-dos, apart from the platform.
  const general = items.filter((i) => i.list === "algemeen");
  const pct = launchPercent(live);
  const current = currentStep(live);

  const date = settings?.launchDate ?? null;
  const days = date ? Math.round((Date.parse(dayKey(date)) - Date.parse(dayKey(new Date()))) / 86_400_000) : null;
  const dateLabel = date
    ? date.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" })
    : null;

  const tabs = [
    { key: "livegang", label: "Livegang", count: live.length, href: "/admin/livegang" },
    { key: "nice", label: "Nice to have", count: nice.length, href: "/admin/livegang?tab=nice" },
    { key: "algemeen", label: "Algemeen", count: general.length, href: "/admin/livegang?tab=algemeen" },
  ];
  const list = tab === "algemeen" ? general : nice;

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl text-ink sm:text-3xl">Planning</h1>

      <nav className="mt-4 flex gap-2" aria-label="Lijst">
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

      {tab === "livegang" ? (
        <>
          <div className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[13px] text-inkSoft">Livegang gepland</div>
                <LaunchDate value={date ? dayKey(date) : ""} label={dateLabel} />
                {days !== null && (
                  <div className="text-[13px] text-inkSoft">
                    {days > 1
                      ? `nog ${days} dagen`
                      : days === 1
                        ? "morgen"
                        : days === 0
                          ? "vandaag"
                          : `${-days} dagen geleden`}
                  </div>
                )}
              </div>
              <div className="text-[28px] font-bold tabular-nums text-[var(--btn-pay-bg)] sm:text-3xl">{pct}%</div>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Klaar voor livegang"
            >
              <div className="h-full rounded-full bg-[var(--btn-pay-bg)]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* The steps on a line down to "Live". */}
          <div className="relative mt-4 pl-8 sm:pl-10">
            <div className="absolute bottom-6 left-[9px] top-4 w-0.5 bg-gray-200" aria-hidden />
            {LAUNCH_STEPS.map((s) => {
              const own = live.filter((i) => i.step === s.step);
              const done = own.filter((i) => i.status === "done").length;
              const isCurrent = s.step === current;
              return (
                <section key={s.step} className="relative mb-3">
                  <span
                    className={`absolute -left-8 top-4 h-5 w-5 rounded-full bg-surface sm:-left-10 ${
                      isCurrent
                        ? "border-[6px] border-[var(--btn-pay-bg)]"
                        : done === own.length && own.length > 0
                          ? "bg-[var(--btn-pay-bg)]"
                          : "border-2 border-gray-300"
                    }`}
                    aria-hidden
                  />
                  <div
                    className={`rounded-xl border bg-surface px-4 pt-3.5 sm:px-5 ${isCurrent ? "border-[var(--btn-pay-bg)]" : "border-line"}`}
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h2 className="text-[15px] font-semibold text-ink">{s.title}</h2>
                      <span className="shrink-0 text-[13px] tabular-nums text-inkSoft">
                        {done} van {own.length}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      {own.map((i) => (
                        <LaunchItemRow
                          key={i.id}
                          id={i.id}
                          title={i.title}
                          status={i.status}
                          list={i.list}
                          step={i.step}
                          note={i.note}
                        />
                      ))}
                      <AddLaunchItem list="livegang" step={s.step} />
                    </div>
                  </div>
                </section>
              );
            })}
            <div className="relative pb-1">
              <span
                className={`absolute -left-8 top-0.5 h-5 w-5 rounded-full sm:-left-10 ${pct === 100 ? "bg-[var(--btn-pay-bg)]" : "border-2 border-gray-300 bg-surface"}`}
                aria-hidden
              />
              <span className="text-[15px] font-semibold text-ink">Live{dateLabel ? ` · ${dateLabel}` : ""}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-col rounded-xl border border-line bg-surface px-4 pt-1 sm:px-5 [&>*:first-child]:border-t-0">
          {list.map((i) => (
            <LaunchItemRow
              key={i.id}
              id={i.id}
              title={i.title}
              status={i.status}
              list={i.list}
              step={i.step}
              note={i.note}
            />
          ))}
          <AddLaunchItem list={tab === "algemeen" ? "algemeen" : "nice"} step={0} />
        </div>
      )}
    </div>
  );
}
