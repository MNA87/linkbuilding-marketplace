import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, CalendarClock, CircleCheck, Clock, FileText, House, MessageSquare, Pencil, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, offerSummary, type LinkType } from "@/lib/customerOverview";
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

  const [offer, expiring, liveCount, plannedCount, cartCount, unread, toFill] = await Promise.all([
    offerSummary(session.user.companyId),
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
  const unreadNumbers = Array.from(new Set(unread.map((m) => `#${m.order.orderNumber}`)));

  // De begroeting toont de voornaam, anders de bedrijfsnaam.
  const name = session.user.name?.trim() ?? "";
  const company = session.user.companyName?.trim() ?? "";
  const firstName = name && name !== company ? name.split(/\s+/)[0] : null;
  const greetName = firstName ?? company ?? name;

  // "Wat je kunt oppakken" — alleen tonen als er écht iets is.
  const hasTodos = Boolean(fillHref) || unread.length > 0 || expiringDomains.length > 0;

  // Prijs zonder centen voor "vanaf" (aanbod-tegels).
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);

  // Gelijke, nette knop voor elke "oppakken"-rij.
  const ACT_BTN = "inline-flex h-10 w-[116px] shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition";

  return (
    <div className="max-w-4xl">
      {/* Begroeting — gecentreerd, met een vriendelijk handje. */}
      <div className="mt-1 text-center">
        <div className="font-serif text-2xl text-ink sm:text-3xl">{greeting(now)} 👋</div>
        {greetName && <div className="mt-1 text-sm font-semibold text-[var(--btn-pay-bg)]">{greetName}</div>}
      </div>

      {/* Nieuwe links plaatsen — blog voorop, met aantal websites + vanaf-prijs. */}
      <h2 className="mt-7 mb-3 text-xs font-semibold uppercase tracking-wide text-inkSoft">Nieuwe links plaatsen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          return (
            <div key={o.type} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <h3 className="font-serif text-xl text-ink">{o.title}</h3>
              </div>
              <p className="mb-4 text-sm text-inkSoft">
                {summary.sites === 0 ? (
                  "Binnenkort beschikbaar"
                ) : (
                  <>
                    Kies uit <span className="font-semibold text-ink">{summary.sites} {summary.sites === 1 ? "website" : "websites"}</span>
                    {from && ` · ${from}`}
                  </>
                )}
              </p>
              <Link
                href={`/marketplace?type=${o.type}`}
                className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--btn-pay-bg)_45%,transparent)] bg-surface px-4 py-2.5 text-sm font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]"
              >
                Bekijk aanbod <ArrowRight size={15} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Wat je kunt oppakken — verdwijnt volledig als er niets is. */}
      {hasTodos && (
        <>
          <h2 className="mt-7 mb-3 text-xs font-semibold uppercase tracking-wide text-inkSoft">Wat je kunt oppakken</h2>
          <div className="space-y-2.5">
            {/* Betaalde links die nog op inhoud wachten — de hoofdactie (groen). */}
            {fillHref && (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Pencil size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">
                    {toFill.length === 1 ? "Lever inhoud aan voor 1 link" : `Lever inhoud aan voor ${toFill.length} links`}
                  </div>
                  <div className="truncate text-sm text-inkSoft">{fillDomains.join(", ")} — dan plaatsen wij 'm</div>
                </div>
                <Link href={fillHref} className={`${ACT_BTN} btn-pay`}>
                  Invullen
                </Link>
              </div>
            )}

            {/* Links die binnenkort verlopen — rustige (neutrale) knop. */}
            {expiringDomains.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Clock size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">
                    {expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}
                  </div>
                  <div className="truncate text-sm text-inkSoft">
                    {expiringDomains.slice(0, 2).join(", ")}
                    {expiringDomains.length > 2 && ` en nog ${expiringDomains.length - 2}`}
                  </div>
                </div>
                <Link
                  href="/dashboard/orders?tab=verloopt"
                  className={`${ACT_BTN} border border-line bg-surface text-ink hover:bg-gray-50`}
                >
                  Verlengen
                </Link>
              </div>
            )}

            {/* Nieuwe reacties op orders — rustige (neutrale) knop. */}
            {unread.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-color)]">
                  <MessageSquare size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">
                    {unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`}
                  </div>
                  <div className="truncate text-sm text-inkSoft">
                    Over {unreadNumbers.length === 1 ? "order" : "orders"} {unreadNumbers.join(", ")}
                  </div>
                </div>
                <Link
                  href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"}
                  className={`${ACT_BTN} border border-line bg-surface text-ink hover:bg-gray-50`}
                >
                  Lezen
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Jouw plaatsingen — Live / Ingepland / In mandje. */}
      <div className="mt-7 mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-inkSoft">Jouw plaatsingen</h2>
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--btn-pay-bg)] hover:underline">
          Naar Mijn orders <ArrowRight size={13} />
        </Link>
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-line bg-surface">
        {[
          { href: "/dashboard/orders?tab=live", label: "Live", value: liveCount, icon: CircleCheck, chip: "bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" },
          { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: plannedCount, icon: CalendarClock, chip: "bg-amber-100 text-amber-700" },
          { href: "/dashboard/marketplace", label: "In mandje", value: cartCount, icon: ShoppingCart, chip: "bg-gray-100 text-inkSoft" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-50 ${i > 0 ? "border-l border-line" : ""}`}
            >
              <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${stat.chip}`}>
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <div className="font-serif text-xl leading-none text-ink tabular-nums">{stat.value}</div>
                <div className="mt-1 text-xs text-inkSoft">{stat.label}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
