import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertCircle, ArrowRight, Clock, FileText, House, MessageSquare, Pencil, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, invoiceSummary, offerSummary, recentOrders, type LinkType } from "@/lib/customerOverview";
import { STAGE_STYLES } from "@/lib/customerOrders";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { awaitingContentWhere } from "@/lib/awaitingContent";
import ClickableRow from "@/components/ClickableRow";

export const metadata: Metadata = { title: "Dashboard" };

const OFFERS: { type: LinkType; title: string; icon: typeof FileText }[] = [
  { type: "BLOG_POST", title: "Blog links", icon: FileText },
  { type: "HOMEPAGE_LINK", title: "Homepage links", icon: House },
];

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  // The layout redirects too, but renders alongside this page.
  if (!session) redirect("/login");
  const customerId = session.user.id;
  const now = new Date();

  const [offer, recent, invoices, expiring, liveCount, plannedCount, cartCount, unread, toFill] = await Promise.all([
    offerSummary(session.user.companyId),
    recentOrders(customerId, 4),
    invoiceSummary(session.user.companyId),
    prisma.orderItem.findMany({
      where: expiringSoonWhere(customerId, now),
      select: {
        websiteProduct: { select: { website: { select: { domain: true } } } },
        placement: { select: { expiresAt: true } },
      },
      orderBy: { placement: { expiresAt: "asc" } },
    }),
    // Live plaatsingen.
    prisma.orderItem.count({
      where: { order: { customerId }, placement: { liveUrl: { not: null }, status: { not: "expired" } } },
    }),
    // Ingepland: gecontroleerd en naar de site gestuurd, nog niet online.
    prisma.orderItem.count({
      where: { order: { customerId, status: { not: "NEW" } }, placement: null, readyToPublish: true, publishAt: { gt: now } },
    }),
    // In je mandje: de bestelling-in-wording.
    prisma.orderItem.count({ where: { order: { customerId, status: "NEW" } } }),
    prisma.orderMessage.findMany({
      where: unreadForCustomerWhere(customerId),
      select: { orderId: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Paid before being filled in ("Nu betalen, later aanleveren").
    prisma.orderItem.findMany({
      where: awaitingContentWhere(customerId),
      select: {
        id: true,
        orderId: true,
        websiteProductId: true,
        websiteProduct: { select: { website: { select: { domain: true } } } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  // The "Invullen" button walks through the first order's links one after another.
  const firstFill = toFill[0];
  const sameOrder = firstFill ? toFill.filter((i) => i.orderId === firstFill.orderId).length : 0;
  const fillHref = firstFill
    ? `/marketplace/${firstFill.websiteProductId}?orderItemId=${firstFill.id}${sameOrder > 1 ? `&stap=1&van=${sameOrder}` : ""}`
    : null;
  const fillDomains = Array.from(new Set(toFill.map((i) => i.websiteProduct.website.domain)));

  const expiringDomains = expiring.map((i) => i.websiteProduct.website.domain);
  const unreadOrders = Array.from(new Set(unread.map((m) => m.orderId)));
  // Reacties per order — voor de badge op recente orders.
  const unreadCountByOrder = new Map<string, number>();
  for (const m of unread) unreadCountByOrder.set(m.orderId, (unreadCountByOrder.get(m.orderId) ?? 0) + 1);
  // Dagen tot de eerstvolgende verlopende link (voor de urgentie-tekst).
  const nextExpiry = expiring
    .map((i) => i.placement?.expiresAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const daysUntil = nextExpiry ? Math.max(0, Math.ceil((nextExpiry.getTime() - now.getTime()) / 86_400_000)) : null;

  const company = session.user.companyName?.trim() ?? "";

  // Helpers.
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;
  const orderDay = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

  // Dezelfde grijze structuur als de marketplace: grijze kopregel, zachte
  // haarlijntjes (border-line/70), serif-titels, vrijwel monochroom.
  const EYE = "mb-3 flex items-baseline justify-between gap-2";
  const EYEH = "font-serif text-[17px] font-semibold text-ink";
  const EYELINK = "inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
  const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-ink whitespace-nowrap";
  const THR = `${TH} text-right`;
  const TD = "px-3.5 py-3 align-middle";
  const TDR = "px-3.5 py-3 text-right align-middle font-semibold tabular-nums text-ink whitespace-nowrap";
  const CHIP = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-gray-50";

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount), zero: liveCount === 0, danger: false },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount), zero: plannedCount === 0, danger: false },
    { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0", zero: invoices.openCount === 0, danger: invoices.overdue },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear), zero: invoices.spentThisYear.toNumber() === 0, danger: false },
  ];

  // Slimme prioritering: de meest urgente taak wordt de uitgelichte regel, de
  // rest komt als rustige chips. Zo springt altijd vanzelf het belangrijkste
  // in het oog.
  type Tone = "pay" | "amber" | "danger";
  type Action = { key: string; tone: Tone; Icon: typeof FileText; title: string; sub?: string; cta: string; href: string };
  const actions: Action[] = [];
  if (invoices.overdue && invoices.dueAt) {
    actions.push({
      key: "invoice",
      tone: "danger",
      Icon: AlertCircle,
      title: invoices.openCount === 1 ? "Openstaande factuur" : `${invoices.openCount} openstaande facturen`,
      sub: `Verlopen op ${orderDay(invoices.dueAt)} · ${euro2(invoices.openAmount)}`,
      cta: "Betalen",
      href: "/dashboard/invoices",
    });
  }
  if (fillHref) {
    actions.push({
      key: "fill",
      tone: "pay",
      Icon: Pencil,
      title: "Lever inhoud aan",
      sub: `${toFill.length} ${toFill.length === 1 ? "link" : "links"} · ${fillDomains.join(", ")}`,
      cta: "Invullen",
      href: fillHref,
    });
  }
  if (expiringDomains.length > 0) {
    actions.push({
      key: "expire",
      tone: "amber",
      Icon: Clock,
      title: expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`,
      sub: daysUntil != null ? (daysUntil === 0 ? "Eerstvolgende: vandaag" : `Eerstvolgende: over ${daysUntil} ${daysUntil === 1 ? "dag" : "dagen"}`) : undefined,
      cta: "Verlengen",
      href: "/dashboard/orders?tab=verloopt",
    });
  }
  if (unread.length > 0) {
    actions.push({
      key: "unread",
      tone: "pay",
      Icon: MessageSquare,
      title: unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`,
      cta: "Lezen",
      href: unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders",
    });
  }
  if (cartCount > 0) {
    actions.push({
      key: "cart",
      tone: "pay",
      Icon: ShoppingCart,
      title: "Bestelling in bewerking",
      sub: `${cartCount} ${cartCount === 1 ? "artikel" : "artikelen"}`,
      cta: "Verder",
      href: "/dashboard/marketplace",
    });
  }
  const hero = actions[0];
  const chips = actions.slice(1);

  const ACT_IC: Record<Tone, string> = { pay: "text-[var(--btn-pay-bg)]", amber: "text-amber-600", danger: "text-red-600" };
  const ACT_BTN: Record<Tone, string> = {
    pay: "bg-[var(--btn-pay-bg)] hover:opacity-90",
    amber: "bg-amber-500 hover:bg-amber-600",
    danger: "bg-red-600 hover:bg-red-700",
  };

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl text-ink">Dashboard</h1>
      {company && <p className="mt-0.5 text-sm text-inkSoft">{company}</p>}

      {/* 1. Conversie — nieuwe links plaatsen staat bovenaan. */}
      <div className={`${EYE} mt-6`}>
        <h2 className={EYEH}>Nieuwe links plaatsen</h2>
        <Link href="/marketplace" className={EYELINK}>Naar de marketplace <ArrowRight size={13} /></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          return (
            <div key={o.type} className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-[var(--btn-pay-bg)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                <Icon size={21} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="font-serif text-[16px] text-ink">{o.title}</div>
                <div className="text-[12.5px] text-inkSoft">
                  {summary.sites === 0 ? (
                    "Binnenkort beschikbaar"
                  ) : (
                    <>
                      <span className="font-semibold text-ink">{summary.sites} {summary.sites === 1 ? "website" : "websites"}</span>
                      {from && ` · ${from}`}
                    </>
                  )}
                </div>
              </div>
              <Link
                href={`/marketplace?type=${o.type}`}
                className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-[var(--btn-pay-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Bekijk aanbod
              </Link>
            </div>
          );
        })}
      </div>

      {/* 2. Je eerstvolgende taak — rustig grijs, met urgentie-accent. */}
      {hero && (
        <Link href={hero.href} className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-gray-50 p-3.5 transition-colors hover:bg-gray-100/70">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface ${ACT_IC[hero.tone]}`}>
            <hero.Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink">{hero.title}</div>
            {hero.sub && <div className="truncate text-[12px] text-inkSoft">{hero.sub}</div>}
          </div>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white ${ACT_BTN[hero.tone]}`}>
            {hero.cta}
          </span>
        </Link>
      )}
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link key={c.key} href={c.href} className={CHIP}>
              <c.Icon size={14} className={ACT_IC[c.tone]} />
              {c.title}
              <ArrowRight size={13} className="text-gray-400" />
            </Link>
          ))}
        </div>
      )}

      {/* 3. Recente orders (marktplaats-tabel) + overzicht. */}
      <div className={`${EYE} mt-7`}>
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
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[o.stage]}`}>
                          {o.stageLabel}
                        </span>
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
            <Link href="/marketplace" className="font-semibold text-[var(--btn-pay-bg)] hover:underline">
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
                      : "font-serif text-lg leading-none text-ink"
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
