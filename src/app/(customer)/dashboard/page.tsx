import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, FileText, House, MessageSquare } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSummary, offerSummary, recentOrders, type LinkType } from "@/lib/customerOverview";
import { STAGE_STYLES } from "@/lib/customerOrders";
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
      select: { orderId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Reacties per order — voor de badge op recente orders.
  const unreadCountByOrder = new Map<string, number>();
  for (const m of unread) unreadCountByOrder.set(m.orderId, (unreadCountByOrder.get(m.orderId) ?? 0) + 1);

  const company = session.user.companyName?.trim() ?? "";

  // Helpers.
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;

  // Stijl: titels serif zoals de marktplaats; sectiekoppen in strak sans-
  // kapitaal; grijze kopregel + zachte haarlijntjes (geen zware scheidingen).
  const EYEH = "text-[11.5px] font-bold uppercase tracking-[0.09em] text-gray-400";
  const EYELINK = "inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
  const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-ink whitespace-nowrap";
  const THR = `${TH} text-right`;
  const TD = "px-3.5 py-3 align-middle";
  const TDR = "px-3.5 py-3 text-right align-middle font-semibold tabular-nums text-ink whitespace-nowrap";
  // Statusbalkjes overal even groot: vaste minimumbreedte, gecentreerd.
  const BADGE = "inline-flex min-w-[124px] justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold";

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount), zero: liveCount === 0, danger: false },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount), zero: plannedCount === 0, danger: false },
    { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0", zero: invoices.openCount === 0, danger: invoices.overdue },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear), zero: invoices.spentThisYear.toNumber() === 0, danger: false },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Dashboard</h1>
      {company && <p className="mt-0.5 text-sm text-inkSoft">{company}</p>}

      {/* 1. Conversie — nieuwe links plaatsen staat bovenaan. */}
      <h2 className={`${EYEH} mb-3 mt-7`}>Nieuwe links plaatsen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          const available = summary.sites > 0;
          return (
            <div key={o.type} className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-[var(--btn-pay-bg)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                <Icon size={21} strokeWidth={1.8} />
              </span>
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
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {recent.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className={TH}>Site</th>
                  <th className={TH}>Status</th>
                  <th className={THR}>Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const Lead = o.kind === "HOMEPAGE_LINK" ? House : FileText;
                  return (
                    <ClickableRow key={o.id} href={`/dashboard/orders/${o.id}`} className="border-t border-line/70 hover:bg-gray-50/60">
                      <td className={TD}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-gray-50 text-inkSoft">
                            <Lead size={14} strokeWidth={1.8} />
                          </span>
                          <span className="font-semibold text-ink">{o.domain}</span>
                          <span className="text-xs text-gray-400 tabular-nums">#{o.orderNumber}</span>
                          {o.extra > 0 && (
                            <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{o.extra}</span>
                          )}
                        </div>
                      </td>
                      <td className={TD}>
                        <span className={`${BADGE} ${STAGE_STYLES[o.stage]}`}>{o.stageLabel}</span>
                        {unreadCountByOrder.has(o.id) && (
                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-semibold text-[var(--btn-pay-bg)]">
                            <MessageSquare size={11} />
                            {unreadCountByOrder.get(o.id)}
                          </span>
                        )}
                      </td>
                      <td className={TDR}>€{Math.round(o.amount).toLocaleString("nl-NL")}</td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-inkSoft">
            Je hebt nog geen orders.{" "}
            <Link href="/dashboard/marketplace" className="font-semibold text-[var(--btn-pay-bg)] hover:underline">
              Bekijk het aanbod
            </Link>
            .
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="bg-gray-50 px-4 py-2.5 text-[11.5px] font-semibold text-ink">Overzicht</div>
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="flex items-center border-t border-line/70 px-4 py-3 text-sm text-ink transition-colors hover:bg-gray-50/60">
              {s.label}
              <span
                className={`ml-auto whitespace-nowrap tabular-nums ${
                  s.danger
                    ? "text-[15px] font-semibold text-red-600"
                    : s.zero
                      ? "text-[15px] font-semibold text-gray-400"
                      : "text-[17px] font-bold text-ink"
                }`}
              >
                {s.value}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
