import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, CalendarClock, CircleCheck, Clock, Eye, FileText, House, MessageSquare, Pencil, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, offerSummary, type LinkType } from "@/lib/customerOverview";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { itemPrice } from "@/lib/writingService";
import { refreshCartWritingFees } from "@/lib/customerPricing";
import { CART_BAR_COOKIE, cartFingerprint } from "@/lib/cartReminder";
import { awaitingContentWhere } from "@/lib/awaitingContent";
import CloseCartBar from "./CloseCartBar";

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
  // The layout redirects too, but renders alongside this page.
  if (!session) redirect("/login");
  const customerId = session.user.id;
  const now = new Date();
  // Houd het schrijf-tarief van mandje-items gelijk aan het actuele tarief
  // (Admin → Instellingen) — anders toont de banner een oud bedrag tot het
  // mandje wordt geopend. No-op als er niets veranderd is.
  await refreshCartWritingFees(customerId, session.user.companyId);

  const [offer, newest, expiring, liveCount, plannedCount, cartItems, unread, toFill] = await Promise.all([
    offerSummary(session.user.companyId),
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
      // Planned once we've checked it and sent it to the site.
      where: { order: { customerId, status: { not: "NEW" } }, placement: null, readyToPublish: true, publishAt: { gt: now } },
    }),
    prisma.orderItem.findMany({
      where: { order: { customerId, status: "NEW" } },
      select: {
        id: true,
        websiteProductId: true,
        customerPriceSnap: true,
        writingFeeSnap: true,
        renewsOrderItemId: true,
        targetUrl: true,
        articleTitle: true,
        articleDocUrl: true,
        writeForMe: true,
        briefLinks: true,
        deliverLater: true,
        websiteProduct: { select: { product: { select: { type: true } } } },
      },
      orderBy: { id: "asc" },
    }),
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
  // The button goes through the first order's links one after another.
  const firstFill = toFill[0];
  const sameOrder = firstFill ? toFill.filter((i) => i.orderId === firstFill.orderId).length : 0;
  const fillHref = firstFill
    ? `/marketplace/${firstFill.websiteProductId}?orderItemId=${firstFill.id}${
        sameOrder > 1 ? `&stap=1&van=${sameOrder}` : ""
      }`
    : null;

  const cartCount = cartItems.length;
  // Closed with the ×: stays away until the cart changes.
  const cartBarHidden =
    (await cookies()).get(CART_BAR_COOKIE)?.value === cartFingerprint(customerId, cartItems.map((i) => i.id));
  // De waarde van de bestelling-in-wording: elk item in het mandje telt mee,
  // of het nu al ingevuld is of nog "Actie nodig" heeft — het heeft hoe dan ook
  // een prijs. Zo toont de banner altijd het echte bedrag, voor iedereen gelijk.
  const cartTotal = cartItems.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0);
  // "item", as the cart itself counts them.
  // A bulk-besteller's cart is their Blog-links order in progress, so the banner
  // speaks of a bestelling and takes them back into Blog links to carry on.
  // Eén flow voor iedereen: de cart is de bestelling-in-wording, dus terug naar
  // Marketplace om verder te gaan — nooit meer naar de oude losse winkelwagen.
  const cartLabel =
    cartCount === 1
      ? "Je hebt een bestelling in bewerking · 1 artikel"
      : `Je hebt een bestelling in bewerking · ${cartCount} artikelen`;
  // The banner just points to the cart — invullen isn't required (an item can be
  // "Artikel volgt later"), and the cart itself shows each item's status and lets
  // you fill in, change or check out.
  const cartAction = { label: "Verder met je bestelling", href: "/dashboard/marketplace" };
  const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
  // The person's first name — none when the name is just the company's.
  const name = session.user.name?.trim() ?? "";
  const firstName = name && name !== session.user.companyName?.trim() ? name.split(/\s+/)[0] : null;

  const expiringDomains = expiring.map((i) => i.websiteProduct.website.domain);
  const unreadOrders = Array.from(new Set(unread.map((m) => m.orderId)));
  const unreadNumbers = Array.from(new Set(unread.map((m) => `#${m.order.orderNumber}`)));

  const showCart = cartCount > 0 && !cartBarHidden;
  const fillDomains = Array.from(new Set(toFill.map((i) => i.websiteProduct.website.domain)));
  // "Te doen": alles wat nu jouw aandacht vraagt op één rij per punt, in plaats
  // van losse grote gekleurde balken. Leeg → de strook verdwijnt helemaal.
  const hasTodos = Boolean(fillHref) || showCart || unread.length > 0 || expiringDomains.length > 0;

  return (
    <div className="max-w-6xl">
      <h1 className="text-lg text-inkSoft">
        {greeting(now)}
        {firstName && `, ${firstName}`}
      </h1>

      {/* Eén nette "Te doen"-strook: per openstaand punt één rustige rij met
          een gekleurd icoontje, een korte tekst en een knop. */}
      {hasTodos && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-inkSoft">
            Te doen
          </h2>

          {/* 1. Betaalde links die nog op inhoud wachten — meest urgent. */}
          {fillHref && (
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Pencil size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">
                  {toFill.length === 1
                    ? "1 betaalde link wacht op jouw inhoud"
                    : `${toFill.length} betaalde links wachten op jouw inhoud`}
                </div>
                <div className="truncate text-sm text-inkSoft">{fillDomains.join(", ")}</div>
              </div>
              <Link
                href={fillHref}
                className="btn-pay inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition"
              >
                Nu invullen <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {/* 2. Bestelling in bewerking — rustige "verder"-knop i.p.v. een
              tweede gele balk; nog altijd met × om 'm weg te leggen. */}
          {showCart && (
            <div className="relative flex flex-col gap-3 border-b border-line px-5 py-4 pr-11 last:border-b-0 sm:flex-row sm:items-center sm:pr-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                <ShoppingCart size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{cartLabel}</div>
                <div className="text-sm text-inkSoft">{euro(cartTotal)} · ga verder waar je gebleven was</div>
              </div>
              <Link
                href={cartAction.href}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gray-50"
              >
                {cartAction.label} <ArrowRight size={15} />
              </Link>
              <CloseCartBar />
            </div>
          )}

          {/* 3. Nieuwe reacties op orders. */}
          {unread.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
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
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gray-50"
              >
                {unread.length === 1 ? "Lees reactie" : "Bekijk reacties"} <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {/* 4. Links die binnenkort verlopen — verlengen via de nieuwe flow. */}
          {expiringDomains.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Clock size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">
                  {expiringDomains.length === 1
                    ? "1 link verloopt binnenkort"
                    : `${expiringDomains.length} links verlopen binnenkort`}
                </div>
                <div className="truncate text-sm text-inkSoft">
                  {expiringDomains.slice(0, 2).join(", ")}
                  {expiringDomains.length > 2 && ` en nog ${expiringDomains.length - 2}`} — verleng voor ze offline gaan
                </div>
              </div>
              <Link
                href="/dashboard/orders?tab=verloopt"
                className="btn-pay inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition"
              >
                Nu verlengen <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Statrij bovenaan: in één oogopslag hoe je plaatsingen ervoor staan. */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { href: "/dashboard/orders?tab=live", label: "Actief online", value: liveCount, icon: CircleCheck },
          { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: plannedCount, icon: CalendarClock },
          { href: "/dashboard/marketplace", label: "In mandje", value: cartCount, icon: ShoppingCart },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border border-line bg-surface px-4 py-4 transition-colors hover:border-[color-mix(in_srgb,var(--btn-pay-bg)_40%,transparent)]"
            >
              <Icon size={18} className="text-inkSoft" />
              <div className="mt-3 font-serif text-3xl leading-none text-ink tabular-nums">{stat.value}</div>
              <div className="mt-1.5 text-xs text-inkSoft sm:text-sm">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      {/* De twee aanbod-kaarten — strak en rustig, de enige sterke knoppen. */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          return (
            <div key={o.type} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-ink/70">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <h2 className="font-serif text-2xl text-ink sm:text-3xl">{o.title}</h2>
                <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold tabular-nums text-ink">
                  {summary.sites.toLocaleString("nl-NL")} {summary.sites === 1 ? "website" : "websites"}
                </span>
              </div>
              {/* The one strong button per kind: the colour of the call to
                  action (Instellingen → Knopkleuren → Actieknop). */}
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

      {/* Nieuwste websites — compact, onderaan. */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line bg-brandSoft/40 px-5 py-3.5 font-serif text-xl text-ink">Nieuwste websites</h2>
        <div className="hidden grid-cols-[minmax(0,1fr)_96px_44px] gap-x-3 px-5 pt-3 pb-1 text-xs font-medium text-inkSoft sm:grid">
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
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line px-5 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_96px_44px]"
            >
              <div className="truncate text-ink">{site.domain}</div>
              <div className="hidden text-center text-sm tabular-nums text-inkSoft sm:block">{addedOn(site.createdAt)}</div>
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
    </div>
  );
}
