import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleCheck, ExternalLink, FileText, House, RefreshCw } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vatTotals } from "@/lib/vat";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { DURATION_YEARS, addYears, durationLabel, hasPeriod, priceForYears } from "@/lib/placementPeriod";
import { renewalStart, renewalYearlyPrices } from "@/lib/renewal";
import { STAGE_DOTS, STAGE_STYLES, articleExcerpt, linkStatus, nlDate, nlDateTime, orderStatus, shortUrl } from "@/lib/customerOrders";
import { messageTime } from "@/lib/orderMessages";
import AddToCartButton from "@/app/(customer)/marketplace/AddToCartButton";
import MessageThread from "@/components/MessageThread";
import ArticlePreview from "./ArticlePreview";
import LinkBlock from "./LinkBlock";
import RefundButton from "./RefundButton";
import RenewPanel, { type RenewOption } from "./RenewPanel";
import { markCustomerMessagesReadAction, sendCustomerMessageAction } from "./actions";

const CANCELLABLE_STATUSES = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS"];

export const metadata: Metadata = { title: "Orderdetails" };

function Card({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-serif text-lg text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

function StatusPill({ stage, label }: { stage: keyof typeof STAGE_STYLES; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[stage]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOTS[stage]}`} />
      {label}
    </span>
  );
}

// One order: every link in it (each with its article, folded), reactions
// about the order, and its details.
export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string; test?: string; link?: string }>;
}) {
  const { id } = await params;
  const { checkout, test, link: focusLink } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          websiteProduct: { include: { website: true, product: true } },
          placement: true,
          renewsOrderItem: { include: { placement: true } },
          renewals: { include: { order: { select: { status: true } } } },
        },
        orderBy: { id: "asc" },
      },
      invoices: { where: { type: "INVOICE" }, orderBy: { issuedAt: "desc" }, take: 1 },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  // Explicit ownership check — a customer may only ever see their own order.
  if (!order || order.customerId !== session.user.id) notFound();

  const now = new Date();
  const hasVat = !order.vatRate.isZero();
  const totals = vatTotals(order.items.map(itemPrice), order.vatRate);
  const invoice = order.invoices[0];

  const links = await Promise.all(
    order.items.map(async (item) => {
      const periodic = hasPeriod(item.websiteProduct.product.type);
      const status = linkStatus({ ...item, orderStatus: order.status, periodic }, now);
      const placement = item.placement;
      const renewable = !item.renewsOrderItemId && periodic && placement?.status === "published" && placement.expiresAt;
      let renewOptions: RenewOption[] = [];
      if (renewable) {
        const yearly = await renewalYearlyPrices(item);
        renewOptions = DURATION_YEARS.map((years) => ({
          years,
          price: priceForYears(yearly.customer, years).toFixed(2).replace(".", ","),
          newEnd: nlDate(addYears(renewalStart(placement.expiresAt, now), years)),
        }));
      }
      return { item, status, renewable, renewOptions };
    })
  );
  const placed = links.filter((l) => !l.item.renewsOrderItemId);
  const summary = placed.length > 0 ? orderStatus(placed.map((l) => l.status.stage)) : null;

  return (
    <div className="max-w-6xl">
      {checkout === "success" && test === "true" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Testmodus: betaling gesimuleerd (Stripe is niet ingesteld) — er is niets echt in rekening gebracht.
        </div>
      )}
      {checkout === "success" && test !== "true" && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          Betaling gelukt. Zodra de bevestiging van Stripe binnen is, zie je de status hieronder bijgewerkt.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Betaling geannuleerd. Je kunt het opnieuw proberen vanuit je winkelmandje.
        </div>
      )}

      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-inkSoft hover:text-ink">
        <ArrowLeft size={15} />
        Mijn orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">Order #{order.orderNumber}</h1>
        {summary && <StatusPill stage={summary.stage} label={summary.label} />}
      </div>
      <p className="text-sm text-inkSoft mt-1">
        {placed.length > 0 ? `${placed.length} ${placed.length === 1 ? "link" : "links"}` : "Verlenging"} · besteld op{" "}
        {nlDateTime(order.createdAt)}
      </p>
      {order.status === "REFUND_REQUESTED" && (
        <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Je annulering is in behandeling. We beoordelen je verzoek en laten het je weten.
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card title={placed.length === 1 ? "Link in deze order" : "Links in deze order"}>
            <div className="space-y-2.5">
              {links.map(({ item, status, renewable, renewOptions }, index) => {
                const isHomepage = item.websiteProduct.product.type === "HOMEPAGE_LINK";
                const Icon = item.renewsOrderItemId ? RefreshCw : isHomepage ? House : FileText;
                const site = item.websiteProduct.website;
                const placement = item.placement;
                const live = (status.stage === "live" || status.stage === "verloopt") && placement?.liveUrl;
                const kind = isHomepage ? "Homepage link" : "Blogartikel";

                const header = (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isHomepage ? "bg-teal-50 text-teal-600" : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-ink">{site.domain}</div>
                      <div className="text-xs text-inkSoft">
                        {item.renewsOrderItemId
                          ? `Verlenging met ${durationLabel(item.durationYears)}${
                              item.renewsOrderItem?.placement?.expiresAt
                                ? ` · loopt nu tot ${nlDate(item.renewsOrderItem.placement.expiresAt)}`
                                : ""
                            }`
                          : `${kind}${status.detail ? ` · ${status.detail.charAt(0).toLowerCase()}${status.detail.slice(1)}` : ""}`}
                      </div>
                    </div>
                    {!item.renewsOrderItemId && <StatusPill stage={status.stage} label={status.label} />}
                    {live && (
                      <a
                        href={placement!.liveUrl!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-brand hover:underline"
                      >
                        {isHomepage ? "Bekijk link" : "Bekijk artikel"} <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                );

                if (item.renewsOrderItemId) {
                  return <LinkBlock key={item.id} id={item.id} header={header} defaultOpen={false} focus={false} />;
                }

                const homepageLinks = item.writeForMe
                  ? parseBriefLinks(item.briefLinks)
                  : item.anchorText
                    ? [{ anchor: item.anchorText, url: item.targetUrl ?? "" }]
                    : [];

                return (
                  <LinkBlock
                    key={item.id}
                    id={item.id}
                    header={header}
                    defaultOpen={!focusLink && index === 0}
                    focus={focusLink === item.id}
                  >
                    {live && placement?.publishedAt && (
                      <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700">
                        <CircleCheck size={14} /> Staat live sinds {nlDateTime(placement.publishedAt)}
                      </p>
                    )}
                    {!live && status.stage !== "geannuleerd" && status.stage !== "verlopen" && (isHomepage || item.articleBody) && (
                      <p className="mb-3 text-xs text-inkSoft">
                        {isHomepage ? "Zo komt je link te staan" : "Zo komt je artikel te staan"} ·{" "}
                        {item.publishAt ? `gaat online op ${nlDateTime(item.publishAt)}` : "gaat online zodra het geplaatst is"}
                      </p>
                    )}

                    {isHomepage ? (
                      <div className="rounded-xl border border-line bg-surface p-4 text-sm">
                        {item.wpCategoryNameSnap && (
                          <div className="text-xs font-semibold uppercase tracking-wider text-inkSoft">{item.wpCategoryNameSnap}</div>
                        )}
                        {homepageLinks.length > 0 ? (
                          homepageLinks.map((l) => (
                            <div key={l.anchor + l.url} className="mt-1.5">
                              <span className="text-brand underline">{l.anchor}</span>
                              {l.url && <span className="ml-2 text-xs text-inkSoft">→ {shortUrl(l.url)}</span>}
                            </div>
                          ))
                        ) : (
                          <div className="mt-1.5 text-inkSoft">Nog geen link ingevuld.</div>
                        )}
                      </div>
                    ) : item.articleTitle && item.articleBody ? (
                      <div className="rounded-xl bg-surface">
                        <ArticlePreview
                          title={item.articleTitle}
                          html={item.articleBody}
                          imageUrl={item.articleImageKey ? `/api/article-images/${item.articleImageKey}` : null}
                          excerpt={articleExcerpt(item.articleBody)}
                        />
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-inkSoft">
                        {item.writeForMe
                          ? "We schrijven je artikel. Zodra het klaar is, zie je het hier."
                          : "Het artikel is nog niet aangeleverd."}
                      </p>
                    )}

                    {renewable && (
                      <div id={`verlengen-${item.id}`} className="mt-4 rounded-xl border border-brand/30 bg-surface p-4">
                        <div className="font-medium text-ink">Verlengen</div>
                        <p className="mt-1 mb-3 text-sm text-ink/80">
                          Je link blijft gewoon staan. De nieuwe periode gaat in op de huidige einddatum, dus eerder verlengen
                          kost je niets extra.
                        </p>
                        <RenewPanel
                          orderItemId={item.id}
                          options={renewOptions}
                          inCartYears={item.renewals.find((r) => r.order.status === "NEW")?.durationYears ?? null}
                        />
                      </div>
                    )}

                    {status.stage === "verlopen" && (
                      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-ink/80">
                        Deze link is verlopen en offline gehaald.{" "}
                        {item.websiteProduct.isAvailable && site.status === "ACTIVE" ? (
                          <>
                            Wil je weer een link op {site.domain}?
                            <div className="mt-3 flex justify-start">
                              <AddToCartButton websiteProductId={item.websiteProductId} />
                            </div>
                          </>
                        ) : (
                          `${site.domain} biedt dit op dit moment niet meer aan.`
                        )}
                      </div>
                    )}
                  </LinkBlock>
                );
              })}
            </div>
          </Card>

          <Card title="Reacties" id="reacties">
            <MessageThread
              orderId={order.id}
              messages={order.messages.map((m) => ({
                id: m.id,
                mine: !m.fromAdmin,
                author: m.fromAdmin ? "Nugevonden" : "Jij",
                time: messageTime(m.createdAt),
                body: m.body,
              }))}
              sendAction={sendCustomerMessageAction}
              unread={order.messages.some((m) => m.fromAdmin && !m.readAt)}
              markReadAction={markCustomerMessagesReadAction}
              placeholder="Stel een vraag of geef een reactie over deze order..."
              note="We reageren zo snel mogelijk. Ons antwoord zie je hier en op je dashboard."
              empty="Vraag of opmerking over deze order? Laat het ons hier weten."
            />
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title="Gegevens">
            <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-inkSoft">Order</dt>
              <dd className="text-ink">#{order.orderNumber}</dd>
              <dt className="text-inkSoft">Besteld</dt>
              <dd className="text-ink">{nlDateTime(order.createdAt)}</dd>
              {placed.length > 0 && (
                <>
                  <dt className="text-inkSoft">Links</dt>
                  <dd className="text-ink">{placed.length}</dd>
                </>
              )}
              <dt className="text-inkSoft">Bedrag</dt>
              <dd className="text-ink">
                €{totals.subtotal.toFixed(2).replace(".", ",")} excl. BTW
                {hasVat && (
                  <span className="block text-xs text-inkSoft">
                    €{totals.total.toFixed(2).replace(".", ",")} incl. {order.vatRate.toNumber()}% BTW
                  </span>
                )}
              </dd>
              {invoice && (
                <>
                  <dt className="text-inkSoft">Factuur</dt>
                  <dd>
                    <a href={`/api/invoices/${invoice.id}/pdf`} className="text-brand hover:underline">
                      Downloaden (PDF)
                    </a>
                  </dd>
                </>
              )}
            </dl>
            {CANCELLABLE_STATUSES.includes(order.status) && (
              <div className="mt-4 border-t border-line pt-3">
                <RefundButton orderId={order.id} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
