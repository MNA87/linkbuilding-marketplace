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

  // "Wat je kunt oppakken" — alleen tonen als er écht iets is (ook een
  // bestelling-in-wording in het mandje telt mee).
  const hasTodos = Boolean(fillHref) || cartCount > 0 || unread.length > 0 || expiringDomains.length > 0;

  // Prijs zonder centen voor "vanaf" (aanbod-tegels).
  const fromLabel = (p: { toNumber(): number } | null) => (p ? `vanaf €${Math.round(p.toNumber())}` : null);

  // Compacte "oppakken"-rij + overal exact even lange knop.
  const ROW = "flex items-center gap-2.5 border-t border-line px-3 py-2.5 first:border-t-0";
  const CTA = "inline-flex h-8 w-[94px] shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition";
  const TXT = "flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden";
  const T1 = "whitespace-nowrap text-[13px] font-semibold text-ink";
  const T2 = "truncate text-xs text-inkSoft";

  const plaatsingen = [
    { href: "/dashboard/orders?tab=live", label: "Live", value: liveCount, icon: CircleCheck, chip: "bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: plannedCount, icon: CalendarClock, chip: "bg-amber-100 text-amber-700" },
    { href: "/dashboard/marketplace", label: "In mandje", value: cartCount, icon: ShoppingCart, chip: "bg-gray-100 text-inkSoft" },
  ];

  return (
    <div className="max-w-5xl">
      {/* Begroeting met een vriendelijk handje. */}
      <div>
        <div className="font-serif text-2xl leading-tight text-ink">{greeting(now)} 👋</div>
        {greetName && <div className="mt-0.5 text-sm font-semibold text-[var(--btn-pay-bg)]">{greetName}</div>}
      </div>

      {/* Nieuwe links plaatsen — blog voorop, met aantal websites + vanaf-prijs. */}
      <h2 className="mt-6 mb-2.5 text-xs font-semibold uppercase tracking-wide text-inkSoft">Nieuwe links plaatsen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          return (
            <div key={o.type} className="flex flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="mb-2.5 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <h3 className="font-serif text-lg text-ink">{o.title}</h3>
              </div>
              <p className="mb-3.5 text-sm text-inkSoft">
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

      {/* Wat je kunt oppakken (links) + Jouw plaatsingen (rechts) — altijd naast
          elkaar. Geen taken? Dan toont links een vriendelijke "je bent bij"-kaart
          i.p.v. een lege plek. */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-inkSoft">Wat je kunt oppakken</h2>
          {hasTodos ? (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {/* Betaalde links die nog op inhoud wachten — hoofdactie (groen). */}
              {fillHref && (
                <div className={`${ROW} bg-amber-50`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                    <Pencil size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{toFill.length === 1 ? "Lever inhoud aan voor 1 link" : `Lever inhoud aan voor ${toFill.length} links`}</span>
                    <span className={T2}>· {fillDomains.join(", ")}</span>
                  </div>
                  <Link href={fillHref} className={`${CTA} btn-pay`}>Invullen</Link>
                </div>
              )}

              {/* Bestelling in bewerking (iets in het mandje). */}
              {cartCount > 0 && (
                <div className={ROW}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                    <ShoppingCart size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>Bestelling in bewerking</span>
                    <span className={T2}>· {cartCount === 1 ? "1 artikel" : `${cartCount} artikelen`}</span>
                  </div>
                  <Link href="/dashboard/marketplace" className={`${CTA} border border-line bg-surface text-ink hover:bg-gray-50`}>Verder</Link>
                </div>
              )}

              {/* Links die binnenkort verlopen. */}
              {expiringDomains.length > 0 && (
                <div className={ROW}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                    <Clock size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}</span>
                    <span className={T2}>· {expiringDomains.slice(0, 2).join(", ")}</span>
                  </div>
                  <Link href="/dashboard/orders?tab=verloopt" className={`${CTA} border border-line bg-surface text-ink hover:bg-gray-50`}>Verlengen</Link>
                </div>
              )}

              {/* Nieuwe reacties op orders. */}
              {unread.length > 0 && (
                <div className={ROW}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-color)]">
                    <MessageSquare size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`}</span>
                    <span className={T2}>· {unreadNumbers.join(", ")}</span>
                  </div>
                  <Link
                    href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"}
                    className={`${CTA} border border-line bg-surface text-ink hover:bg-gray-50`}
                  >
                    Lezen
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-4 py-9 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
                <CircleCheck size={22} />
              </span>
              <div className="mt-3 text-sm font-semibold text-ink">Je bent helemaal bij 🎉</div>
              <div className="mt-1 text-xs text-inkSoft">Niks wat nu je aandacht vraagt.</div>
            </div>
          )}
        </div>

        {/* Jouw plaatsingen — altijd ernaast (verticale kaart). */}
        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-inkSoft">Jouw plaatsingen</h2>
            <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--btn-pay-bg)] hover:underline">
              Mijn orders <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {plaatsingen.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href} className="flex items-center gap-2.5 border-t border-line px-3.5 py-3 transition-colors first:border-t-0 hover:bg-gray-50">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
                    <Icon size={15} />
                  </span>
                  <span className="text-sm text-ink">{s.label}</span>
                  <span className="ml-auto font-serif text-lg leading-none text-ink tabular-nums">{s.value}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
