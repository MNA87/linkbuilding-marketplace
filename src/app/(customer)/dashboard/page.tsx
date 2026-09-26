import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, CalendarClock, CircleCheck, Clock, FileText, House, MessageSquare, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, offerSummary, type LinkType } from "@/lib/customerOverview";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { hasPeriod } from "@/lib/placementPeriod";
import AddToCartButton from "../marketplace/AddToCartButton";

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

const OFFERS: {
  type: LinkType;
  title: string;
  text: string;
  icon: typeof FileText;
  // Blue for blog links, teal for homepage links — the same on every page.
  accent: string;
  tile: string;
  button: string;
}[] = [
  {
    type: "BLOG_POST",
    title: "Blog links",
    text: "Een artikel met jouw link, op een website naar keuze.",
    icon: FileText,
    accent: "bg-brand",
    tile: "bg-brandSoft text-brand",
    button: "btn-primary",
  },
  {
    type: "HOMEPAGE_LINK",
    title: "Homepage links",
    text: "Jouw link direct op de voorpagina, meteen online.",
    icon: House,
    accent: "bg-teal-500",
    tile: "bg-teal-50 text-teal-700",
    button: "bg-teal-600 text-white hover:bg-teal-700",
  },
];

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  const customerId = session!.user.id;
  const now = new Date();

  const [offer, newest, expiring, liveCount, plannedCount, cartCount, unread] = await Promise.all([
    offerSummary(),
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true } } },
      include: {
        metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
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
    prisma.orderItem.count({ where: { order: { customerId, status: "NEW" } } }),
    prisma.orderMessage.findMany({
      where: unreadForCustomerWhere(customerId),
      select: { orderItemId: true, orderItem: { select: { websiteProduct: { select: { website: { select: { domain: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const expiringDomains = expiring.map((i) => i.websiteProduct.website.domain);
  const unreadItems = Array.from(new Set(unread.map((m) => m.orderItemId)));
  const unreadDomains = Array.from(new Set(unread.map((m) => m.orderItem.websiteProduct.website.domain)));

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">
        {greeting(now)}, {session!.user.companyName}
      </h1>

      <div className="grid gap-4 md:grid-cols-2 mt-5">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          return (
            <Link
              key={o.type}
              href={`/marketplace?type=${o.type}`}
              className="group relative overflow-hidden bg-surface border border-line rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${o.accent}`} />
              <span className={`hidden sm:flex w-16 h-16 shrink-0 rounded-2xl items-center justify-center ${o.tile}`}>
                <Icon size={30} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-2xl text-ink">{o.title}</div>
                <div className="text-sm text-inkSoft mt-1">{o.text}</div>
                <div className="text-sm text-inkSoft mt-1 whitespace-nowrap">
                  <span className="font-semibold text-ink">
                    {summary.sites} {summary.sites === 1 ? "website" : "websites"}
                  </span>
                  {summary.fromPrice && (
                    <>
                      {" "}
                      · vanaf €{summary.fromPrice.toFixed(0)}
                      {hasPeriod(o.type) && " per jaar"}
                    </>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${o.button}`}
              >
                Bekijk aanbod <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-5 items-start">
        <section className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-end justify-between gap-4 px-5 pt-5 pb-4 border-b border-line bg-brandSoft/40">
            <h2 className="font-serif text-xl text-ink">Nieuwste websites</h2>
            <Link href="/marketplace?type=BLOG_POST" className="text-sm text-inkSoft hover:text-ink whitespace-nowrap">
              Alle websites →
            </Link>
          </div>
          <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_96px_44px_72px_120px] gap-x-3 px-5 pt-3 pb-1 text-xs font-medium text-inkSoft">
            <span>Website</span>
            <span className="text-center">Toegevoegd</span>
            <span className="text-center">DR</span>
            <span className="text-center">Prijs</span>
            <span />
          </div>
          {newest.map((site) => {
            const wp = mainProduct(site.websiteProducts);
            const dr = site.metrics[0]?.domainRating;
            return (
              <div
                key={site.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_96px_44px_72px_120px] gap-x-3 items-center px-5 py-3.5 border-t border-line first:border-t-0"
              >
                <div className="text-ink truncate">{site.domain}</div>
                <div className="hidden xl:block text-center text-sm text-inkSoft tabular-nums">{addedOn(site.createdAt)}</div>
                <div className="hidden xl:block text-center text-sm">
                  {dr != null ? <span className="text-ink">{dr}</span> : <span className="text-inkSoft">—</span>}
                </div>
                <div className="hidden xl:block text-center">
                  <div className="text-ink">€{wp.supplierPrice.toFixed(0)}</div>
                  <div className="text-xs text-inkSoft">{hasPeriod(wp.product.type) ? "per jaar" : "eenmalig"}</div>
                </div>
                <div className="text-right">
                  <AddToCartButton websiteProductId={wp.id} />
                </div>
              </div>
            );
          })}
          {newest.length === 0 && <div className="px-5 py-8 text-center text-sm text-inkSoft">Nog geen websites.</div>}
        </section>

        <div className="space-y-4 order-first md:order-none">
          {unread.length > 0 && (
            <div className="rounded-2xl border border-blue-300 bg-blue-50 p-5 text-blue-900">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquare size={18} />
                {unread.length === 1 ? "Je hebt 1 nieuwe reactie" : `Je hebt ${unread.length} nieuwe reacties`}
              </div>
              <p className="text-sm mt-1.5">Over {unreadDomains.join(", ")}.</p>
              <Link
                href={unreadItems.length === 1 ? `/dashboard/orders/link/${unreadItems[0]}#reacties` : "/dashboard/orders"}
                className="inline-block mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
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
            {cartCount > 0 && (
              <Link
                href="/dashboard/cart"
                className="btn-pay mt-3 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
              >
                Afrekenen <ArrowRight size={15} />
              </Link>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
