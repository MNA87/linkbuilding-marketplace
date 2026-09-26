import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, CalendarClock, CircleCheck, Clock, Eye, FileText, House, MessageSquare, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, offerSummary, type LinkType } from "@/lib/customerOverview";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { itemPrice } from "@/lib/writingService";

export const metadata: Metadata = { title: "Dashboard" };

const NEWEST_COUNT = 5;

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Amsterdam" }).format(now)
  );
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

const addedOn = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Amsterdam" });

// One row per site: its blog link if it has one, otherwise what it does offer.
function mainProduct<T extends { product: { type: string } }>(products: T[]): T {
  return products.find((p) => p.product.type === "BLOG_POST") ?? products[0];
}

const OFFERS: { type: LinkType; title: string; icon: typeof FileText }[] = [
  { type: "BLOG_POST", title: "Blog links", icon: FileText },
  { type: "HOMEPAGE_LINK", title: "Homepage links", icon: House },
];

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  const customerId = session!.user.id;
  const now = new Date();

  const [offer, newest, expiring, liveCount, plannedCount, cartItems, unread] = await Promise.all([
    offerSummary(),
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true } } },
      include: {
        websiteProducts: { where: { isAvailable: true }, include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      take: NEWEST_COUNT,
    }),
    prisma.orderItem.findMany({
      where: expiringSoonWhere(customerId, now),
      select: { websiteProduct: { select: { website: { select: { domain: true } } } } },
      orderBy: { placement: { expiresAt: "asc" } },
    }),
    prisma.orderItem.count({
      where: { order: { customerId }, placement: { liveUrl: { not: null }, status: { not: "expired" } } },
    }),
    prisma.orderItem.count({
      where: { order: { customerId, status: { not: "NEW" } }, placement: null, publishAt: { gt: now } },
    }),
    prisma.orderItem.findMany({
      where: { order: { customerId, status: "NEW" } },
      select: { customerPriceSnap: true, writingFeeSnap: true },
    }),
    prisma.orderMessage.findMany({
      where: unreadForCustomerWhere(customerId),
      select: { orderId: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const cartCount = cartItems.length;
  const cartTotal = cartItems.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0);
  const cartLabel = cartCount === 1 ? "1 link in je mandje" : `${cartCount} links in je mandje`;
  const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
  // The person's first name; the company name only if there's no name.
  const firstName = session!.user.name?.trim().split(/\s+/)[0] || session!.user.companyName;

  const expiringDomains = expiring.map((i) => i.websiteProduct.website.domain);
  const unreadOrders = Array.from(new Set(unread.map((m) => m.orderId)));
  const unreadNumbers = Array.from(new Set(unread.map((m) => `#${m.order.orderNumber}`)));

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">
        {greeting(now)}, {firstName}
      </h1>

      {/* Something left in the cart: the first thing you see, with the total. */}
      {cartCount > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] px-5 py-4 sm:flex-row sm:items-center">
          <ShoppingCart size={20} className="hidden shrink-0 text-ink/70 sm:block" />
          <div className="flex-1 text-ink">
            <span className="font-semibold">{cartLabel}</span>
            <span className="text-inkSoft"> · {euro(cartTotal)} excl. BTW</span>
          </div>
          <Link
            href="/dashboard/cart"
            className="btn-pay inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition"
          >
            Afrekenen <ArrowRight size={15} />
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 mt-5">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          return (
            <div key={o.type} className="bg-surface border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex w-12 h-12 shrink-0 rounded-xl items-center justify-center bg-gray-100 text-ink/70">
                  <Icon size={24} strokeWidth={1.7} />
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-ink">{o.title}</h2>
                <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-ink tabular-nums">
                  {summary.sites.toLocaleString("nl-NL")} {summary.sites === 1 ? "website" : "websites"}
                </span>
              </div>
              {/* The one strong button per kind: the colour of the call to
                  action (Stamdata → Knopkleuren → Betaalknop). */}
              <Link
                href={`/marketplace?type=${o.type}`}
                className="btn-pay mt-5 flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-base font-semibold transition"
              >
                Bekijk aanbod <ArrowRight size={16} />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-5 items-start">
        <section className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-end justify-between gap-4 px-5 pt-5 pb-4 border-b border-line bg-brandSoft/40">
            <h2 className="font-serif text-xl text-ink">Nieuwste websites</h2>
          </div>
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_96px_44px] gap-x-3 px-5 pt-3 pb-1 text-xs font-medium text-inkSoft">
            <span>Website</span>
            <span className="text-center">Toegevoegd</span>
            <span />
          </div>
          {/* No price or DR here — the eye opens the site in the aanbod
              (under Blog links, or Homepage links if that's all it has),
              on top and opened, where the details are. */}
          {newest.map((site) => {
            const wp = mainProduct(site.websiteProducts);
            return (
              <div
                key={site.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_96px_44px] gap-x-3 items-center px-5 py-3 border-t border-line first:border-t-0"
              >
                <div className="text-ink truncate">{site.domain}</div>
                <div className="hidden sm:block text-center text-sm text-inkSoft tabular-nums">{addedOn(site.createdAt)}</div>
                <Link
                  href={`/marketplace?type=${wp.product.type}&site=${wp.id}`}
                  aria-label={`Bekijk ${site.domain}`}
                  title="Bekijken"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-inkSoft transition-colors hover:border-[var(--btn-pay-bg)] hover:bg-[var(--pay-soft)] hover:text-[var(--btn-pay-bg)]"
                >
                  <Eye size={17} />
                </Link>
              </div>
            );
          })}
          {newest.length === 0 && <div className="px-5 py-8 text-center text-sm text-inkSoft">Nog geen websites.</div>}
        </section>

        <div className="space-y-4 order-first md:order-none">
          {unread.length > 0 && (
            <div className="rounded-2xl border border-[var(--primary-color)] bg-[var(--primary-soft)] p-5 text-ink">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquare size={18} />
                {unread.length === 1 ? "Je hebt 1 nieuwe reactie" : `Je hebt ${unread.length} nieuwe reacties`}
              </div>
              <p className="text-sm mt-1.5">
                Over {unreadNumbers.length === 1 ? "order" : "orders"} {unreadNumbers.join(", ")}.
              </p>
              <Link
                href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"}
                className="btn-primary inline-block mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition"
              >
                {unread.length === 1 ? "Lees reactie" : "Bekijk reacties"}
              </Link>
            </div>
          )}

          {expiringDomains.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <Clock size={18} />
                {expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}
              </div>
              <p className="text-sm mt-1.5">
                {expiringDomains.slice(0, 2).join(" en ")}
                {expiringDomains.length > 2 && ` en nog ${expiringDomains.length - 2}`} — verleng ze voordat ze offline gaan.
              </p>
              <Link
                href="/dashboard/orders?tab=verloopt"
                className="inline-block mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Nu verlengen
              </Link>
            </div>
          )}

          <div className="bg-surface border border-line rounded-2xl p-5">
            <h2 className="font-serif text-xl text-ink">Jouw links</h2>
            <p className="text-xs text-inkSoft mt-0.5 mb-4">Zo staan je plaatsingen ervoor</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { href: "/dashboard/orders?tab=live", label: "Actief", value: liveCount, icon: CircleCheck },
                { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: plannedCount, icon: CalendarClock },
                { href: "/dashboard/cart", label: "In mandje", value: cartCount, icon: ShoppingCart },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <Link
                    key={stat.label}
                    href={stat.href}
                    className="rounded-xl border border-line bg-brandSoft/30 px-3 py-3 transition-colors hover:border-brand/40"
                  >
                    <Icon size={17} className="text-inkSoft" />
                    <div className="font-serif text-2xl text-ink mt-2 leading-none">{stat.value}</div>
                    <div className="text-xs text-inkSoft mt-1">{stat.label}</div>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
