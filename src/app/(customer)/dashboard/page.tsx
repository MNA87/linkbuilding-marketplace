import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, Clock, FileText, House, MessageSquare, Pencil, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, invoiceSummary, offerSummary, recentOrders, type LinkType } from "@/lib/customerOverview";
import { STAGE_STYLES } from "@/lib/customerOrders";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { awaitingContentWhere } from "@/lib/awaitingContent";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Amsterdam" }).format(now)
  );
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

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
      select: { websiteProduct: { select: { website: { select: { domain: true } } } } },
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

  // De begroeting toont de voornaam, anders de bedrijfsnaam.
  const name = session.user.name?.trim() ?? "";
  const company = session.user.companyName?.trim() ?? "";
  const firstName = name && name !== company ? name.split(/\s+/)[0] : null;
  const greetName = firstName ?? company ?? name;

  // Prijs zonder centen voor "vanaf" (aanbod-tegels).
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;
  const orderDay = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

  // Dezelfde stijl als de marketplace: serif-titels, rustige kaarten, groene
  // pill-knoppen, sage accenten, vrijwel monochroom.
  const EYE = "mb-3 flex items-baseline justify-between gap-2";
  const EYEH = "font-serif text-[17px] font-semibold text-ink";
  const EYELINK = "inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
  const STAT = "flex items-center border-t border-[var(--hair)] px-4 py-3 text-sm text-ink transition-colors first:border-t-0 hover:bg-gray-50";

  // Kleine ghost-pil voor secundaire taak-acties.
  const CHIP = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-gray-50";

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount), zero: liveCount === 0 },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount), zero: plannedCount === 0 },
    { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0", zero: invoices.openCount === 0 },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear), zero: invoices.spentThisYear.toNumber() === 0 },
  ];

  // Wat vraagt nu je aandacht (voor de begroetingsregel + chips).
  const todoCount = (fillHref ? 1 : 0) + (cartCount > 0 ? 1 : 0) + (expiringDomains.length > 0 ? 1 : 0) + (unread.length > 0 ? 1 : 0);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Begroeting + korte context. */}
      <h1 className="font-serif text-2xl leading-tight text-ink">
        {greeting(now)}{greetName ? `, ${greetName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-inkSoft">
        {company && company !== greetName && <>{company} · </>}
        {fillHref ? (
          <span className="font-semibold text-[var(--btn-pay-bg)]">
            {toFill.length} {toFill.length === 1 ? "link wacht" : "links wachten"} op inhoud
          </span>
        ) : todoCount > 0 ? (
          <span className="font-semibold text-[var(--btn-pay-bg)]">
            {todoCount === 1 ? "1 ding vraagt je aandacht" : `${todoCount} dingen vragen je aandacht`}
          </span>
        ) : (
          "alles bijgewerkt"
        )}
      </p>

      {/* 1. Je eerstvolgende actie — groot, persoonlijk. */}
      {fillHref && (
        <Link
          href={fillHref}
          className="mt-6 flex items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--btn-pay-bg)_22%,transparent)] bg-[var(--pay-soft)] p-4 transition hover:brightness-[0.98] sm:p-5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-[var(--btn-pay-bg)]">
            <Pencil size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[16px] font-semibold text-ink">Lever inhoud aan</div>
            <div className="truncate text-[12.5px] text-inkSoft">
              {toFill.length} {toFill.length === 1 ? "link" : "links"} · {fillDomains.join(", ")}
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--btn-pay-bg)] px-5 py-2.5 text-sm font-semibold text-white">
            Invullen
          </span>
        </Link>
      )}

      {/* Secundaire taken als rustige chips. */}
      {(cartCount > 0 || expiringDomains.length > 0 || unread.length > 0) && (
        <div className={`flex flex-wrap gap-2 ${fillHref ? "mt-3" : "mt-6"}`}>
          {unread.length > 0 && (
            <Link href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"} className={CHIP}>
              <MessageSquare size={14} className="text-[var(--btn-pay-bg)]" />
              {unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`}
              <ArrowRight size={13} className="text-gray-400" />
            </Link>
          )}
          {expiringDomains.length > 0 && (
            <Link href="/dashboard/orders?tab=verloopt" className={CHIP}>
              <Clock size={14} className="text-amber-600" />
              {expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}
              <ArrowRight size={13} className="text-gray-400" />
            </Link>
          )}
          {cartCount > 0 && (
            <Link href="/dashboard/marketplace" className={CHIP}>
              <ShoppingCart size={14} className="text-[var(--btn-pay-bg)]" />
              Bestelling in bewerking · {cartCount}
              <ArrowRight size={13} className="text-gray-400" />
            </Link>
          )}
        </div>
      )}

      {/* 2 + 3. Recente orders + jouw cijfers. */}
      <div className={`${EYE} mt-8`}>
        <h2 className={EYEH}>Recente orders</h2>
        <Link href="/dashboard/orders" className={EYELINK}>Mijn orders <ArrowRight size={13} /></Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        {recent.length > 0 ? (
          <div className="divide-y divide-[var(--hair)] overflow-hidden rounded-2xl border border-line bg-surface">
            {recent.map((o) => {
              const Lead = o.kind === "HOMEPAGE_LINK" ? House : FileText;
              return (
                <Link key={o.id} href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-inkSoft">
                    <Lead size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{o.domain}</span>
                      <span className="shrink-0 text-xs text-gray-400 tabular-nums">#{o.orderNumber}</span>
                      {o.extra > 0 && (
                        <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">
                          +{o.extra}
                        </span>
                      )}
                    </div>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[o.stage]}`}>
                      {o.stageLabel}
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                    €{Math.round(o.amount).toLocaleString("nl-NL")}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-inkSoft">
              <ShoppingCart size={22} strokeWidth={1.7} />
            </span>
            <div className="font-serif text-[16px] font-semibold text-ink">Nog geen orders</div>
            <p className="mt-1 max-w-xs text-sm text-inkSoft">
              Plaats je eerste link in de marketplace — binnen een paar klikken geregeld.
            </p>
            <Link href="/marketplace" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--btn-pay-bg)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              Naar de marketplace <ArrowRight size={15} />
            </Link>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className={STAT}>
              {s.label}
              <span className={`ml-auto whitespace-nowrap tabular-nums ${s.zero ? "text-[15px] font-semibold text-gray-400" : "font-serif text-lg leading-none text-ink"}`}>
                {s.value}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. Meer links plaatsen — compact, secundair. */}
      <hr className="mt-9 border-line" />
      <p className="mb-3 mt-7 text-[11px] font-bold uppercase tracking-[0.09em] text-gray-400">Meer links plaatsen</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          return (
            <div key={o.type} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="font-serif text-[15px] text-ink">{o.title}</div>
                <div className="text-[12.5px] text-inkSoft">
                  {summary.sites === 0 ? (
                    "Binnenkort beschikbaar"
                  ) : (
                    <>{summary.sites} {summary.sites === 1 ? "website" : "websites"}{from && ` · ${from}`}</>
                  )}
                </div>
              </div>
              <Link
                href={`/marketplace?type=${o.type}`}
                className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gray-50"
              >
                Bekijk
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
