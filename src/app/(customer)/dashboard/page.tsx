import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, Calendar, Clock, ExternalLink, FileText, House, RefreshCw, ShoppingCart, Upload } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSummary, offerSummary, recentOrders, type LinkType, type RecentOrder } from "@/lib/customerOverview";
import { STAGE_DOT, STAGE_PILL_NEUTRAL } from "@/lib/customerOrders";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import ClickableRow from "@/components/ClickableRow";

export const metadata: Metadata = { title: "Dashboard" };

const OFFERS: { type: LinkType; title: string; soort: string; desc: string; icon: typeof FileText }[] = [
  { type: "BLOG_POST", title: "Blog links", soort: "blog", desc: "Redactioneel artikel met jouw link", icon: FileText },
  { type: "HOMEPAGE_LINK", title: "Homepage links", soort: "homepage", desc: "Jouw link direct op de voorpagina", icon: House },
];

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  // The layout redirects too, but renders alongside this page.
  if (!session) redirect("/login");
  const customerId = session.user.id;
  const now = new Date();

  const [offer, recent, invoices, liveCount, plannedCount, unread, company, cartCount] = await Promise.all([
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
    // Betaalt deze klant op rekening (verzamelfactuur) of meteen? Bepaalt of
    // "Openstaande facturen" relevant is.
    session.user.companyId
      ? prisma.company.findUnique({ where: { id: session.user.companyId }, select: { bulkOrdering: true } })
      : Promise.resolve(null),
    // Links in het winkelmandje = regels op een order dat nog NEW (niet afgerekend) is.
    prisma.orderItem.count({ where: { order: { customerId, status: "NEW" } } }),
  ]);
  const onAccount = company?.bulkOrdering ?? false;

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
  const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[12px] font-semibold text-ink whitespace-nowrap";
  const THR = `${TH} text-right`;
  const TD = "px-3.5 py-3 align-middle";
  // Status als zachte tint-pill; de actie (groene knop) staat ernaast.
  const PILL = "inline-flex min-w-[150px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";
  const ACT = "relative z-10 inline-flex h-9 w-[150px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs";
  const BTN = `${ACT} bg-[var(--btn-pay-bg)] font-semibold text-white transition hover:opacity-90`;
  // Oranje voor de actie die op de klant wacht ("Lever aan").
  const BTN_WARN = `${ACT} bg-[#ea580c] font-semibold text-white transition hover:opacity-90`;
  const BTN_GHOST = `${ACT} border-[1.5px] border-[var(--btn-pay-bg)] bg-surface font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]`;
  const CHIP = `${ACT} bg-gray-100 font-medium text-gray-500`;
  const StatusPill = ({ o }: { o: RecentOrder }) => (
    <span className={`${PILL} gap-1.5 ${STAGE_PILL_NEUTRAL}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAGE_DOT[o.stage]}`} />
      {o.stageLabel}
    </span>
  );
  const ProjectChip = ({ name }: { name: string }) => (
    <span className={name === "—" ? "text-gray-400" : "text-ink"}>{name}</span>
  );
  // De volgende stap voor deze order.
  const Action = ({ o }: { o: RecentOrder }) => {
    if (o.needsContent) return <Link href={`/dashboard/orders/${o.id}`} className={BTN_WARN}><Upload size={14} /> Lever aan</Link>;
    if (o.stage === "verloopt") return <Link href={`/dashboard/orders/${o.id}`} className={BTN_GHOST}><RefreshCw size={14} /> Verleng</Link>;
    if (o.stage === "live") return o.liveUrl
      ? <a href={o.liveUrl} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}><ExternalLink size={13} /> Bekijk</a>
      : <span className={CHIP}>online</span>;
    if (o.stage === "ingepland") return <span className={CHIP}><Calendar size={13} className="text-gray-400" /> {o.plannedLabel ? `online ${o.plannedLabel}` : "binnenkort"}</span>;
    if (o.stage === "behandeling") return <span className={CHIP}><Clock size={13} className="text-gray-400" /> wordt geplaatst</span>;
    return null;
  };

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount), zero: liveCount === 0, danger: false },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount), zero: plannedCount === 0, danger: false },
    onAccount
      ? { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0", zero: invoices.openCount === 0, danger: invoices.overdue }
      : { href: "/dashboard/invoices", label: "Facturen", value: String(invoices.countThisYear), zero: invoices.countThisYear === 0, danger: false },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear), zero: invoices.spentThisYear.toNumber() === 0, danger: false },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Dashboard</h1>

      {/* Winkelmandje-herinnering: alleen als er nog plaatsingen in het mandje
          zitten (een niet-afgerekende order). Gele banner, zoals "wacht op
          jouw inhoud". */}
      {cartCount > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm sm:mt-4 sm:w-[calc(50%-0.375rem)] sm:flex-row sm:items-center sm:gap-3">
          <ShoppingCart size={18} className="hidden shrink-0 text-amber-800 sm:block" />
          <div className="min-w-0 flex-1 text-amber-900">
            <span className="font-semibold">
              {cartCount === 1 ? "1 plaatsing in je winkelmandje" : `${cartCount} plaatsingen in je winkelmandje`}
            </span>{" "}
            · Rond je bestelling af.
          </div>
          <Link
            href="/dashboard/marketplace"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-[var(--btn-pay-bg)] bg-surface px-4 py-2 text-sm font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]"
          >
            Naar winkelmandje <ArrowRight size={15} />
          </Link>
        </div>
      )}

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

      {/* 1. Conversie — per type een eigen kop ("Blog links"/"Homepage links")
          met daaronder een balk: aantal sites (tegeltje) · vanaf-prijs · knop.
          Geen aparte "Nieuwe links plaatsen"-kop meer. */}
      <div className="mt-7 grid gap-x-3 gap-y-5 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const from = fromLabel(summary.fromPrice);
          const available = summary.sites > 0;
          return (
            <div key={o.type}>
              <h3 className={`${EYEH} mb-2`}>{o.title}</h3>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-[var(--btn-pay-bg)]">
                {available ? (
                  <>
                    {/* Aantal-paneel: zacht indigo zodat het opvalt zonder met de
                        groene actieknop te botsen. */}
                    <div className="flex w-[84px] shrink-0 flex-col items-center justify-center bg-[#f1f4f8] leading-none text-[#5d6b7d]">
                      <span className="text-[26px] font-extrabold">{summary.sites}</span>
                      <span className="mt-1 text-[9.5px] font-bold uppercase tracking-wide">{summary.sites === 1 ? "site" : "sites"}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-3 border-l border-line p-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-ink">{from ? `${from.charAt(0).toUpperCase()}${from.slice(1)}` : "Beschikbaar"}</div>
                        <div className="truncate text-[12.5px] text-inkSoft">{o.desc}</div>
                      </div>
                      <Link
                        href={`/dashboard/marketplace?soort=${o.soort}`}
                        className="ml-auto shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-[var(--btn-pay-bg)] bg-surface px-4 py-2 text-sm font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]"
                      >
                        Bekijk aanbod
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-[13px] text-inkSoft">Binnenkort beschikbaar</div>
                )}
              </div>
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
                  <th className={`${TH} w-[16%]`}>Datum</th>
                  <th className={`${TH} w-[14%]`}>Site</th>
                  <th className={`${TH} w-[18%]`}>Status</th>
                  <th className={`${TH} w-[18%]`}>Project</th>
                  <th className={`${THR} w-[9%]`}>Bedrag</th>
                  <th className={`${TH} text-center w-[18%]`}>Actie</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const live = o.stage === "live" && o.liveUrl;
                  return (
                  <ClickableRow
                    key={o.id}
                    href={live ? o.liveUrl! : `/dashboard/orders/${o.id}`}
                    newTab={!!live}
                    className="border-t border-line/70 hover:bg-gray-50/60"
                  >
                    <td className={`${TD} whitespace-nowrap tabular-nums text-ink`}>#{o.orderNumber}</td>
                    <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{orderDay(o.date)}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{o.domain}</span>
                        {o.extra > 0 && (
                          <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{o.extra}</span>
                        )}
                      </div>
                    </td>
                    <td className={TD}><StatusPill o={o} /></td>
                    <td className={TD}><ProjectChip name={o.project} /></td>
                    <td className={`${TD} text-right tabular-nums text-[13px] text-inkSoft whitespace-nowrap`}>€{Math.round(o.amount).toLocaleString("nl-NL")}</td>
                    <td className={`${TD} text-center`}><Action o={o} /></td>
                  </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2.5 md:hidden">
            {recent.map((o) => {
              const live = o.stage === "live" && o.liveUrl;
              return (
              <div key={o.id} className="relative flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5">
                {live ? (
                  <a href={o.liveUrl!} target="_blank" rel="noopener noreferrer" className="absolute inset-0 rounded-xl" aria-label={`${o.domain} openen`} />
                ) : (
                  <Link href={`/dashboard/orders/${o.id}`} className="absolute inset-0 rounded-xl" aria-label={`Order ${o.orderNumber} openen`} />
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-ink">{o.domain}</span>
                    {o.extra > 0 && (
                      <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{o.extra}</span>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-inkSoft">€{Math.round(o.amount).toLocaleString("nl-NL")}</span>
                </div>
                <div className="text-[11.5px] text-gray-400">
                  #{o.orderNumber} · {orderDay(o.date)}{o.project !== "—" ? ` · ${o.project}` : ""}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                  <StatusPill o={o} />
                  <Action o={o} />
                </div>
              </div>
              );
            })}
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
