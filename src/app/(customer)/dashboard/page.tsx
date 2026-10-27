import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, ChevronRight, FileText, Folder, House } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSummary, offerSummary, recentOrders, type LinkType } from "@/lib/customerOverview";
import { STAGE_TONE, type LinkStage } from "@/lib/customerOrders";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import ClickableRow from "@/components/ClickableRow";

export const metadata: Metadata = { title: "Dashboard" };

const OFFERS: { type: LinkType; title: string; soort: string; icon: typeof FileText }[] = [
  { type: "BLOG_POST", title: "Blog links", soort: "blog", icon: FileText },
  { type: "HOMEPAGE_LINK", title: "Homepage links", soort: "homepage", icon: House },
];

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  // The layout redirects too, but renders alongside this page.
  if (!session) redirect("/login");
  const customerId = session.user.id;
  const now = new Date();

  const [offer, recent, invoices, liveCount, plannedCount, unread] = await Promise.all([
    offerSummary(session.user.companyId),
    recentOrders(customerId, 4),
    invoiceSummary(session.user.companyId),
    // Live plaatsingen.
    prisma.orderItem.count({
      where: { order: { customerId }, placement: { liveUrl: { not: null }, status: { not: "expired" } } },
    }),
    // Ingepland: gecontroleerd en naar de site gestuurd, nog niet online.
    prisma.orderItem.count({
      where: { order: { customerId, status: { not: "NEW" } }, placement: null, readyToPublish: true, publishAt: { gt: now } },
    }),
    prisma.orderMessage.findMany({
      where: unreadForCustomerWhere(customerId),
      orderBy: { createdAt: "desc" },
      select: {
        orderId: true,
        body: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            items: {
              where: { renewsOrderItemId: null },
              orderBy: { id: "asc" },
              take: 1,
              select: { websiteProduct: { select: { website: { select: { domain: true } } } } },
            },
          },
        },
      },
    }),
  ]);

  // "Nieuwe berichten"-blok: het nieuwste ongelezen bericht per order (unread is
  // al nieuw-naar-oud gesorteerd), met één klik naar de chat van die order.
  const ago = (d: Date) => {
    const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min geleden`;
    if (s < 86_400) return `${Math.floor(s / 3600)} uur geleden`;
    const days = Math.floor(s / 86_400);
    return days === 1 ? "gisteren" : `${days} dagen geleden`;
  };
  const seenMsg = new Set<string>();
  const messages = unread
    .filter((m) => !seenMsg.has(m.orderId) && (seenMsg.add(m.orderId), true))
    .slice(0, 5)
    .map((m) => ({
      orderId: m.orderId,
      orderNumber: m.order.orderNumber,
      domain: m.order.items[0]?.websiteProduct.website.domain ?? "—",
      snippet: m.body,
      when: ago(m.createdAt),
    }));

  // Helpers.
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;
  const orderDay = (d: Date) =>
    `${d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" })} · ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;

  // Stijl: titels serif zoals de marktplaats; sectiekoppen in strak sans-
  // kapitaal; grijze kopregel + zachte haarlijntjes (geen zware scheidingen).
  const EYEH = "text-[11.5px] font-bold uppercase tracking-[0.09em] text-gray-400";
  const EYELINK = "inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
  const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft whitespace-nowrap";
  const THR = `${TH} text-right`;
  const TD = "px-3.5 py-3 align-middle";
  // Status: stip + gekleurd woord (Voorstel B). Project: mapje-pil.
  const Status = ({ stage, label, planned }: { stage: LinkStage; label: string; planned: string | null }) => {
    const t = STAGE_TONE[stage];
    return (
      <span className={`inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium ${t.text}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
        {label}
        {planned && <span className="font-normal text-inkSoft">· {planned}</span>}
      </span>
    );
  };
  const ProjectChip = ({ name }: { name: string }) =>
    name === "—" ? (
      <span className="text-gray-400">—</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-xs text-ink">
        <Folder size={12} className="text-[var(--btn-pay-bg)]" />
        {name}
      </span>
    );

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount), zero: liveCount === 0, danger: false },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount), zero: plannedCount === 0, danger: false },
    { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0", zero: invoices.openCount === 0, danger: invoices.overdue },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear), zero: invoices.spentThisYear.toNumber() === 0, danger: false },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Dashboard</h1>

      {/* Nieuwe berichten — één klik naar de chat van de order. */}
      {messages.length > 0 && (
        <>
          <h2 className={`${EYEH} mb-3 mt-6`}>Nieuwe berichten</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {messages.map((m) => (
              <Link
                key={m.orderId}
                href={`/dashboard/orders/${m.orderId}#reacties`}
                className="flex items-center gap-2.5 border-t border-line/70 px-4 py-3 transition-colors first:border-t-0 hover:bg-gray-50/60"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--btn-pay-bg)]" />
                <span className="shrink-0 text-sm font-semibold text-ink">{m.domain}</span>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums">#{m.orderNumber}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-inkSoft">{m.snippet}</span>
                <span className="hidden shrink-0 text-xs text-gray-400 sm:block">{m.when}</span>
                <ArrowRight size={15} className="shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 1. Conversie — nieuwe links plaatsen staat bovenaan. */}
      <h2 className={`${EYEH} mb-3 mt-7`}>Nieuwe links plaatsen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const from = fromLabel(summary.fromPrice);
          const available = summary.sites > 0;
          return (
            <div key={o.type} className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-[var(--btn-pay-bg)]">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-ink">{o.title}</div>
                <div className="text-[12.5px] text-inkSoft">
                  {available ? (
                    <>
                      <span className="font-semibold text-ink">{summary.sites} {summary.sites === 1 ? "website" : "websites"}</span>
                      {from && ` · ${from}`}
                    </>
                  ) : (
                    "Binnenkort beschikbaar"
                  )}
                </div>
              </div>
              {available && (
                <Link
                  href={`/dashboard/marketplace?soort=${o.soort}`}
                  className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-[var(--btn-pay-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Bekijk aanbod
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Recente orders (marktplaats-tabel) + overzicht. */}
      <div className="mb-3 mt-7 flex items-center justify-between gap-2">
        <h2 className={EYEH}>Recente orders</h2>
        <Link href="/dashboard/orders" className={EYELINK}>Mijn orders <ArrowRight size={13} /></Link>
      </div>
      {recent.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${TH} w-[7%]`}>Order</th>
                  <th className={`${TH} w-[25%]`}>Site</th>
                  <th className={`${TH} w-[17%]`}>Project</th>
                  <th className={`${TH} w-[15%]`}>Datum</th>
                  <th className={`${TH} w-[22%]`}>Status</th>
                  <th className={`${THR} w-[10%]`}>Bedrag</th>
                  <th className={`${TH} w-[4%]`} aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <ClickableRow
                    key={o.id}
                    href={`/dashboard/orders/${o.id}`}
                    className={`group border-t border-line/70 hover:bg-gray-50/60 ${o.needsContent ? "bg-amber-50/40" : ""}`}
                  >
                    <td className={`${TD} whitespace-nowrap border-l-[3px] tabular-nums text-ink ${STAGE_TONE[o.stage].bar}`}>#{o.orderNumber}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{o.domain}</span>
                        {o.extra > 0 && (
                          <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{o.extra}</span>
                        )}
                      </div>
                    </td>
                    <td className={TD}><ProjectChip name={o.project} /></td>
                    <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{orderDay(o.date)}</td>
                    <td className={TD}><Status stage={o.stage} label={o.stageLabel} planned={o.plannedLabel} /></td>
                    <td className={`${TD} text-right tabular-nums text-[13px] text-inkSoft whitespace-nowrap`}>€{Math.round(o.amount).toLocaleString("nl-NL")}</td>
                    <td className={`${TD} text-right`}>
                      <ChevronRight size={16} className="ml-auto text-gray-300 transition-colors group-hover:text-[var(--btn-pay-bg)]" />
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2.5 md:hidden">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/orders/${o.id}`}
                className={`relative flex flex-col gap-2 overflow-hidden rounded-xl border p-3.5 pl-4 ${
                  o.needsContent ? "border-amber-200 bg-amber-50/60" : "border-line bg-surface"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-[3px] ${STAGE_TONE[o.stage].dot}`} aria-hidden="true" />
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-ink">{o.domain}</span>
                    {o.extra > 0 && (
                      <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{o.extra}</span>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-inkSoft">€{Math.round(o.amount).toLocaleString("nl-NL")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-gray-400">
                  <span>#{o.orderNumber} · {orderDay(o.date)}</span>
                  {o.project !== "—" && <ProjectChip name={o.project} />}
                </div>
                <Status stage={o.stage} label={o.stageLabel} planned={o.plannedLabel} />
              </Link>
            ))}
          </div>
        </>
      ) : (
          <div className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-inkSoft">
            Je hebt nog geen orders.{" "}
            <Link href="/dashboard/marketplace" className="font-semibold text-[var(--btn-pay-bg)] hover:underline">
              Bekijk het aanbod
            </Link>
            .
          </div>
        )}

      {/* 3. Overzicht — compacte strip onder de orders. */}
      <h2 className={`${EYEH} mb-3 mt-7`}>Overzicht</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-[var(--btn-pay-bg)]">
            <div className="text-[12.5px] text-inkSoft">{s.label}</div>
            <div
              className={`mt-1 tabular-nums ${
                s.danger
                  ? "text-[18px] font-semibold text-red-600"
                  : s.zero
                    ? "text-[18px] font-semibold text-gray-400"
                    : "text-[20px] font-bold text-ink"
              }`}
            >
              {s.value}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
