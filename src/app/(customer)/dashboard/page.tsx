import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, CalendarClock, CircleCheck, Clock, FileText, House, MessageSquare, Pencil, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expiringSoonWhere, invoiceSummary, newestSites, offerSummary, type LinkType } from "@/lib/customerOverview";
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

  // Gedeelde bouwstenen. Elk blok krijgt een eigen kleur-accent (dun randje
  // links + gekleurd icoon); de kaarten zelf blijven wit — geen kleurvlakken.
  const CARD = "flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5";
  const CHEAD = "mb-2.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-inkSoft";
  const CHLINK = "inline-flex items-center gap-1 text-[13px] font-semibold normal-case tracking-normal text-[var(--btn-pay-bg)] hover:underline";
  const ROW = "flex items-center gap-2.5 border-t border-[var(--hair)] py-2.5 first:border-t-0";
  const CHIP = "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100";
  const CTA = "inline-flex h-8 w-[94px] shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition";
  const GHOST = "border border-line bg-surface text-ink hover:bg-gray-50";
  const TXT = "flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden";
  const T1 = "whitespace-nowrap text-[13px] font-semibold text-ink";
  const T2 = "truncate text-xs text-inkSoft";

  // Kleur-accenten per blok.
  const AC = { green: "var(--btn-pay-bg)", blue: "#3f7cb8", amber: "#9a7324", slate: "#4a6670", violet: "#7c5cc4", rose: "#b05a6a" };
  const accent = (c: string) => ({ borderLeftWidth: 4, borderLeftColor: c });
  const euro2 = (d: { toFixed(n: number): string }) => `€${d.toFixed(2).replace(".", ",")}`;
  const euroRound = (d: { toNumber(): number }) => `€${Math.round(d.toNumber()).toLocaleString("nl-NL")}`;
  const dayShort = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

  const plaatsingen = [
    { href: "/dashboard/orders?tab=live", label: "Live", value: liveCount, icon: CircleCheck },
    { href: "/dashboard/orders?tab=ingepland", label: "Ingepland", value: plannedCount, icon: CalendarClock },
    { href: "/dashboard/marketplace", label: "In mandje", value: cartCount, icon: ShoppingCart },
  ];

  return (
    <div className="w-full">
      {/* Begroeting met een vriendelijk handje. */}
      <div>
        <div className="font-serif text-2xl leading-tight text-ink">{greeting(now)} 👋</div>
        {greetName && <div className="mt-0.5 text-sm font-semibold text-[var(--btn-pay-bg)]">{greetName}</div>}
      </div>

      {/* Volgorde: Blog + Homepage boven, dan Openstaand + Nieuwe sites, onder
          Jouw plaatsingen + Facturen. Elk blok een eigen kleur-accent (randje
          links), witte kaarten. Vult de breedte en zakt op smal scherm naar
          één kolom. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Aanbod-tegels — simpel: categorie + aantal + vanaf-prijs + knop. */}
        {OFFERS.map((o) => {
          const summary = offer[o.type];
          const Icon = o.icon;
          const from = fromLabel(summary.fromPrice);
          const ac = o.type === "BLOG_POST" ? AC.green : AC.blue;
          return (
            <div key={o.type} className={CARD} style={accent(ac)}>
              <div className="flex items-center gap-3">
                <span className={`${CHIP} h-10 w-10 rounded-xl`} style={{ color: ac }}>
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-ink">{o.title}</h3>
                  <p className="text-sm text-inkSoft">
                    {summary.sites === 0 ? (
                      "Binnenkort beschikbaar"
                    ) : (
                      <>
                        Kies uit <span className="font-semibold text-ink">{summary.sites} {summary.sites === 1 ? "website" : "websites"}</span>
                        {from && ` · ${from}`}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href={`/marketplace?type=${o.type}`}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--btn-pay-bg)_45%,transparent)] bg-surface px-4 py-2.5 text-sm font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]"
              >
                Bekijk aanbod <ArrowRight size={15} />
              </Link>
            </div>
          );
        })}

        {/* Openstaand — jouw taken. Niks te doen? Dan een "je bent bij"-kaart. */}
        <div className={CARD} style={accent(AC.amber)}>
          <h2 className={CHEAD}>Openstaand</h2>
          {hasTodos ? (
            <div>
              {fillHref && (
                <div className={ROW}>
                  <span className={CHIP} style={{ color: AC.amber }}>
                    <Pencil size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{toFill.length === 1 ? "Lever inhoud aan voor 1 link" : `Lever inhoud aan voor ${toFill.length} links`}</span>
                    <span className={T2}>· {fillDomains.join(", ")}</span>
                  </div>
                  <Link href={fillHref} className={`${CTA} btn-pay`}>Invullen</Link>
                </div>
              )}
              {cartCount > 0 && (
                <div className={ROW}>
                  <span className={CHIP} style={{ color: AC.amber }}>
                    <ShoppingCart size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>Bestelling in bewerking</span>
                    <span className={T2}>· {cartCount === 1 ? "1 artikel" : `${cartCount} artikelen`}</span>
                  </div>
                  <Link href="/dashboard/marketplace" className={`${CTA} ${GHOST}`}>Verder</Link>
                </div>
              )}
              {expiringDomains.length > 0 && (
                <div className={ROW}>
                  <span className={CHIP} style={{ color: AC.amber }}>
                    <Clock size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{expiringDomains.length === 1 ? "1 link verloopt binnenkort" : `${expiringDomains.length} links verlopen binnenkort`}</span>
                    <span className={T2}>· {expiringDomains.slice(0, 2).join(", ")}</span>
                  </div>
                  <Link href="/dashboard/orders?tab=verloopt" className={`${CTA} ${GHOST}`}>Verlengen</Link>
                </div>
              )}
              {unread.length > 0 && (
                <div className={ROW}>
                  <span className={CHIP} style={{ color: AC.amber }}>
                    <MessageSquare size={15} />
                  </span>
                  <div className={TXT}>
                    <span className={T1}>{unread.length === 1 ? "1 nieuwe reactie" : `${unread.length} nieuwe reacties`}</span>
                    <span className={T2}>· {unreadNumbers.join(", ")}</span>
                  </div>
                  <Link
                    href={unreadOrders.length === 1 ? `/dashboard/orders/${unreadOrders[0]}#reacties` : "/dashboard/orders"}
                    className={`${CTA} ${GHOST}`}
                  >
                    Lezen
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100" style={{ color: AC.amber }}>
                <CircleCheck size={22} />
              </span>
              <div className="mt-3 text-sm font-semibold text-ink">Je bent helemaal bij 🎉</div>
              <div className="mt-1 text-xs text-inkSoft">Niks wat nu je aandacht vraagt.</div>
            </div>
          )}
        </div>

        {/* Nieuwe sites — de nieuwste beschikbare websites. */}
        <div className={CARD} style={accent(AC.slate)}>
          <div className={CHEAD}>
            <span>Nieuwe sites</span>
            <Link href="/marketplace" className={CHLINK}>Alle websites <ArrowRight size={13} /></Link>
          </div>
          {sites.length > 0 ? (
            <div>
              {sites.map((s) => (
                <Link
                  key={s.websiteId}
                  href={`/marketplace/${s.productId}`}
                  className={`${ROW} transition-colors hover:bg-gray-50`}
                >
                  <span className="min-w-0 max-w-full truncate text-[13px] font-semibold text-ink">{s.domain}</span>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[#eff3f0] px-2 py-0.5 text-[11px] font-medium text-[#5b7266]">
                    {s.type === "HOMEPAGE_LINK" ? "Homepage" : "Blog"}
                  </span>
                  {s.dr != null && <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-inkSoft">DR {s.dr}</span>}
                  {s.da != null && <span className="hidden shrink-0 whitespace-nowrap text-[11px] tabular-nums text-inkSoft sm:inline">DA {s.da}</span>}
                  <span className="ml-auto shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-ink">
                    €{Math.round(s.fromPrice.toNumber())}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-inkSoft">Binnenkort nieuw aanbod.</p>
          )}
        </div>

        {/* Jouw plaatsingen. */}
        <div className={CARD} style={accent(AC.violet)}>
          <div className={CHEAD}>
            <span>Jouw plaatsingen</span>
            <Link href="/dashboard/orders" className={CHLINK}>Mijn orders <ArrowRight size={13} /></Link>
          </div>
          <div>
            {plaatsingen.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href} className={`${ROW} transition-colors hover:bg-gray-50`}>
                  <span className={CHIP} style={{ color: AC.violet }}>
                    <Icon size={15} />
                  </span>
                  <span className="text-sm text-ink">{s.label}</span>
                  <span className="ml-auto font-serif text-lg leading-none text-ink tabular-nums">{s.value}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Facturen — openstaand + besteed dit jaar. */}
        <div className={CARD} style={accent(AC.rose)}>
          <div className={CHEAD}>
            <span>Facturen</span>
            <Link href="/dashboard/invoices" className={CHLINK}>Alle facturen <ArrowRight size={13} /></Link>
          </div>
          <div>
            <Link href="/dashboard/invoices" className={`${ROW} transition-colors hover:bg-gray-50`}>
              <span className={CHIP} style={{ color: AC.rose }}>
                <Receipt size={15} />
              </span>
              <div className={TXT}>
                {invoices.openCount > 0 ? (
                  <>
                    <span className={T1}>{invoices.openCount === 1 ? "1 factuur open" : `${invoices.openCount} facturen open`}</span>
                    {invoices.dueAt && (
                      <span className={invoices.overdue ? "truncate text-xs font-semibold text-red-600" : T2}>
                        · {invoices.overdue ? "te laat sinds" : "vervalt"} {dayShort(invoices.dueAt)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={T1}>Geen openstaande facturen</span>
                )}
              </div>
              {invoices.openCount > 0 && (
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{euro2(invoices.openAmount)}</span>
              )}
            </Link>
            <div className={ROW}>
              <span className={CHIP} style={{ color: AC.rose }}>
                <Wallet size={15} />
              </span>
              <div className={TXT}>
                <span className={T1}>Besteed dit jaar</span>
                <span className={T2}>· {now.getFullYear()}</span>
              </div>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{euroRound(invoices.spentThisYear)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
