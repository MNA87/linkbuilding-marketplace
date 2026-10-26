import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, Clock, FileText, House, MessageSquare, Pencil, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, invoiceSummary, newestSites, offerSummary, type LinkType } from "@/lib/customerOverview";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { awaitingContentWhere } from "@/lib/awaitingContent";
import ClickableRow from "@/components/ClickableRow";

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

  const [offer, sites, invoices, expiring, liveCount, plannedCount, cartCount, unread, toFill] = await Promise.all([
    offerSummary(session.user.companyId),
    newestSites(session.user.companyId, 3),
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

  // Dezelfde stijl als de marketplace: serif-titels, nette tabel met kolommen,
  // sage niche-pillen, rechts uitgelijnde tabular-cijfers, groene pill-knoppen.
  const EYE = "mb-3 flex items-baseline justify-between gap-2";
  const EYEH = "font-serif text-[17px] font-semibold text-ink";
  const EYELINK = "inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
  const PILL = "inline-block whitespace-nowrap rounded-full bg-[#eff3f0] px-2.5 py-0.5 text-[11.5px] font-medium text-[#5b7266]";
  const TH = "whitespace-nowrap bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft";
  const THR = `${TH} text-right`;
  const TD = "whitespace-nowrap px-4 py-3 text-sm";
  const TDN = `${TD} text-right tabular-nums text-ink`;
  const STAT = "flex items-center border-t border-[var(--hair)] py-3 text-sm text-ink transition-opacity first:border-t-0 hover:opacity-70";
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;
  const dayShort = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
  const nlNum = (n: number | null) => (n == null ? "–" : n.toLocaleString("nl-NL"));

  // Hoeveel staat er open (voor de begroetingsregel).
  const todoCount = (fillHref ? 1 : 0) + (cartCount > 0 ? 1 : 0) + (expiringDomains.length > 0 ? 1 : 0) + (unread.length > 0 ? 1 : 0);

  const stats = [
    { href: "/dashboard/orders?tab=live", label: "Live plaatsingen", value: String(liveCount) },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: String(plannedCount) },
    { href: "/dashboard/invoices", label: "Openstaande facturen", value: invoices.openCount > 0 ? euro2(invoices.openAmount) : "€0" },
    { href: "/dashboard/invoices", label: `Besteed in ${now.getFullYear()}`, value: euroRound(invoices.spentThisYear) },
  ];

  // Kleine ghost-pil voor secundaire taak-acties (zelfde ronde vorm als de
  // marketplace-knoppen, maar omlijnd).
  const GHOSTPILL = "inline-flex h-8 shrink-0 items-center rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-gray-50";
  const TODOIC = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-inkSoft";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Begroeting + korte context. */}
      <h1 className="font-serif text-2xl leading-tight text-ink">
        {greeting(now)}{greetName ? `, ${greetName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-inkSoft">
        {company && company !== greetName && <>{company} · </>}
        {todoCount > 0 ? (
          <span className="font-semibold text-[var(--btn-pay-bg)]">
            {todoCount === 1 ? "1 ding staat open" : `${todoCount} dingen staan open`}
          </span>
        ) : (
          "alles bijgewerkt"
        )}
      </p>

      {/* Nieuwe links plaatsen — twee rustige kaarten met groene pill-knop. */}
      <div className={`${EYE} mt-7`}>
        <h2 className={EYEH}>Nieuwe links plaatsen</h2>
        <Link href="/marketplace" className={EYELINK}>Naar de marketplace <ArrowRight size={13} /></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          return (
            <div key={o.type} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
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
                className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-[var(--btn-pay-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Bekijk aanbod
              </Link>
            </div>
          );
        })}
      </div>

      {/* Nieuwe sites — dezelfde tabel-stijl als de marketplace. */}
      <div className={`${EYE} mt-7`}>
        <h2 className={EYEH}>Nieuwe sites</h2>
        <Link href="/marketplace" className={EYELINK}>Alle websites <ArrowRight size={13} /></Link>
      </div>
      {sites.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>Site</th>
                <th className={TH}>Niche</th>
                <th className={THR}>DR</th>
                <th className={`${THR} hidden sm:table-cell`}>DA</th>
                <th className={`${THR} hidden md:table-cell`}>Verkeer</th>
                <th className={THR}>Prijs</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <ClickableRow key={s.websiteId} href={`/marketplace/${s.productId}`} className="border-t border-[var(--hair)] hover:bg-gray-50">
                  <td className={`${TD} font-semibold text-ink`}>
                    <Link href={`/marketplace/${s.productId}`} className="hover:underline">{s.domain}</Link>
                  </td>
                  <td className={TD}><span className={PILL}>{s.niche}</span></td>
                  <td className={TDN}>{nlNum(s.dr)}</td>
                  <td className={`${TDN} hidden sm:table-cell`}>{nlNum(s.da)}</td>
                  <td className={`${TDN} hidden md:table-cell`}>{nlNum(s.traffic)}</td>
                  <td className={`${TDN} font-bold`}>€{Math.round(s.fromPrice.toNumber())}</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface px-4 py-6 text-sm text-inkSoft">Binnenkort nieuw aanbod.</div>
      )}

      {/* Jouw overzicht — taak (indien) + rustige cijfers. */}
      <div className={`${EYE} mt-7`}>
        <h2 className={EYEH}>Jouw overzicht</h2>
        <Link href="/dashboard/orders" className={EYELINK}>Mijn orders <ArrowRight size={13} /></Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="space-y-2">
          {fillHref ? (
            <Link href={fillHref} className="flex items-center gap-3 rounded-xl bg-[var(--pay-soft)] p-3.5 transition hover:brightness-[0.98]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-[var(--btn-pay-bg)]">
                <Pencil size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">Lever inhoud aan</div>
                <div className="truncate text-[11.5px] text-inkSoft">{toFill.length} {toFill.length === 1 ? "link" : "links"} · {fillDomains.join(", ")}</div>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--btn-pay-bg)] px-4 py-2 text-xs font-semibold text-white">Invullen</span>
            </Link>
          ) : (
            todoCount === 0 && (
              <div className="rounded-xl border border-line bg-surface p-3.5 text-sm text-inkSoft">
                Niks wat nu je aandacht vraagt — je bent helemaal bij. 🎉
              </div>
            )
          )}

          {cartCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <span className={TODOIC}><ShoppingCart size={15} /></span>
              <div className="min-w-0 flex-1 text-[13px] text-ink">Bestelling in bewerking <span className="text-inkSoft">· {cartCount === 1 ? "1 artikel" : `${cartCount} artikelen`}</span></div>
              <Link href="/dashboard/marketplace" className={GHOSTPILL}>Verder</Link>
            </div>
          )}
          {expiringDomains.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <span className={TODOIC}><Clock size={15} /></span>
              <div className="min-w-0 flex-1 text-[13px] text-ink">{expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}</div>
              <Link href="/dashboard/orders?tab=verloopt" className={GHOSTPILL}>Verlengen</Link>
            </div>
          )}
          {unread.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <span className={TODOIC}><MessageSquare size={15} /></span>
              <div className="min-w-0 flex-1 text-[13px] text-ink">{unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`}</div>
              <Link href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"} className={GHOSTPILL}>Lezen</Link>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface px-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className={STAT}>
              {s.label}
              <span className="ml-auto whitespace-nowrap font-serif text-lg leading-none text-ink tabular-nums">{s.value}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
