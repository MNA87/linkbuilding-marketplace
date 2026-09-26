import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, ExternalLink } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { DURATION_YEARS, addYears, durationLabel, hasPeriod, priceForYears } from "@/lib/placementPeriod";
import { renewalStart, renewalYearlyPrices } from "@/lib/renewal";
import { STAGE_DOTS, STAGE_STYLES, articleExcerpt, linkStatus, nlDate, nlDateTime, shortUrl } from "@/lib/customerOrders";
import AddToCartButton from "@/app/(customer)/marketplace/AddToCartButton";
import MessageThread from "@/components/MessageThread";
import { messageTime } from "@/lib/orderMessages";
import ArticlePreview from "./ArticlePreview";
import RenewPanel, { type RenewOption } from "./RenewPanel";
import { markCustomerMessagesReadAction, sendCustomerMessageAction } from "./actions";

export const metadata: Metadata = { title: "Orderdetails" };

function Card({ title, id, children, className = "" }: { title: string; id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-6 rounded-2xl border bg-surface p-5 ${className || "border-line"}`}>
      <h2 className="font-serif text-lg text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

// One bought link: how far along it is, the article (or link) as it goes
// on the site, reactions, and — for a homepage link — renewing it.
export default async function CustomerLinkPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
      order: { include: { invoices: { where: { type: "INVOICE" }, orderBy: { issuedAt: "desc" }, take: 1 } } },
      renewals: { include: { order: { select: { status: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  // Explicit ownership check — a customer may only ever see their own links.
  if (!item || item.order.customerId !== session.user.id || item.renewsOrderItemId || item.order.status === "NEW") {
    notFound();
  }

  const now = new Date();
  const periodic = hasPeriod(item.websiteProduct.product.type);
  const status = linkStatus({ ...item, orderStatus: item.order.status, periodic }, now);
  const site = item.websiteProduct.website;
  const isHomepage = item.websiteProduct.product.type === "HOMEPAGE_LINK";
  const placement = item.placement;
  const live = (status.stage === "live" || status.stage === "verloopt") && placement?.liveUrl;
  const invoice = item.order.invoices[0];

  // Verlengen (homepage links): +1/+2/+3 years from the current end date.
  const renewable = periodic && placement?.status === "published" && placement.expiresAt;
  let renewOptions: RenewOption[] = [];
  if (renewable) {
    const yearly = await renewalYearlyPrices(item);
    renewOptions = DURATION_YEARS.map((years) => ({
      years,
      price: priceForYears(yearly.customer, years).toFixed(2).replace(".", ","),
      newEnd: nlDate(addYears(renewalStart(placement.expiresAt, now), years)),
    }));
  }
  const inCart = item.renewals.find((r) => r.order.status === "NEW");

  // Voortgang: paid → being handled (written) → planned (if a day was picked) → live.
  const steps = ["Betaald", item.writeForMe ? "Wordt geschreven" : "In behandeling", ...(item.publishAt ? ["Ingepland"] : []), "Live"];
  const current = status.stage === "behandeling" ? 1 : status.stage === "ingepland" ? 2 : steps.length;

  // Above the article: where it stands, or the link to it once it's live.
  const articleNote = live ? null : item.publishAt
    ? `gaat online op ${nlDateTime(item.publishAt)}`
    : "gaat online zodra het geplaatst is";

  const details: [string, React.ReactNode][] = [
    ["Order", `#${item.order.orderNumber}`],
    ["Besteld", nlDateTime(item.order.createdAt)],
    ["Soort", isHomepage ? "Homepage link" : "Blogartikel"],
  ];
  if (isHomepage && item.wpCategoryNameSnap) details.push(["Rubriek", item.wpCategoryNameSnap]);
  details.push([
    "Online",
    placement?.publishedAt
      ? `Sinds ${nlDate(placement.publishedAt)}`
      : item.publishAt
        ? `Gepland op ${nlDate(item.publishAt)}`
        : "Zo snel mogelijk",
  ]);
  details.push(["Looptijd", periodic ? durationLabel(item.durationYears) : "Blijft voor altijd online"]);
  if (periodic && placement?.expiresAt) {
    details.push([status.stage === "verlopen" ? "Liep tot" : "Loopt tot", <b key="e">{nlDate(placement.expiresAt)}</b>]);
  }
  details.push(["Bedrag", `€${itemPrice(item).toFixed(2).replace(".", ",")} excl. BTW`]);
  if (invoice) {
    details.push([
      "Factuur",
      <a key="f" href={`/api/invoices/${invoice.id}/pdf`} className="text-brand hover:underline">
        Downloaden (PDF)
      </a>,
    ]);
  }

  const homepageLinks = item.writeForMe
    ? parseBriefLinks(item.briefLinks)
    : item.anchorText
      ? [{ anchor: item.anchorText, url: item.targetUrl ?? "" }]
      : [];

  return (
    <div className="max-w-6xl">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-inkSoft hover:text-ink">
        <ArrowLeft size={15} />
        Mijn orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">{site.domain}</h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOTS[status.stage]}`} />
          {status.label}
        </span>
      </div>
      <p className="text-sm text-inkSoft mt-1">
        Order #{item.order.orderNumber} · {isHomepage ? "Homepage link" : "Blogartikel"}
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {status.stage === "geannuleerd" ? (
            <div className="rounded-2xl border border-line bg-gray-50 p-5 text-sm text-ink/80">
              {status.label === "Geannuleerd"
                ? "Deze order is geannuleerd. Deze link wordt niet geplaatst."
                : "Je hebt deze order geannuleerd. We beoordelen je verzoek en laten het je weten."}
            </div>
          ) : (
            <Card title="Voortgang">
              <ol className="flex">
                {steps.map((step, i) => {
                  const done = i < current;
                  const active = i === current;
                  return (
                    <li key={step} className="relative flex-1 text-center">
                      {i < steps.length - 1 && (
                        <span
                          className={`absolute left-1/2 top-[9px] h-0.5 w-full ${i + 1 <= current ? "bg-emerald-500" : "bg-gray-200"}`}
                        />
                      )}
                      <span
                        className={`relative mx-auto flex h-5 w-5 items-center justify-center rounded-full ${
                          done ? "bg-emerald-500 text-white" : active ? "bg-brand ring-4 ring-brandSoft" : "bg-gray-200"
                        }`}
                      >
                        {done && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span
                        className={`mt-1.5 block text-xs ${active ? "font-semibold text-brand" : done ? "text-ink" : "text-inkSoft"}`}
                      >
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          <Card title={isHomepage ? "Je link" : "Je artikel"}>
            {live && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                <CircleCheck size={16} className="shrink-0" />
                <span className="flex-1">
                  Staat live{placement?.publishedAt ? ` sinds ${nlDateTime(placement.publishedAt)}` : ""}
                </span>
                <a
                  href={placement!.liveUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                >
                  Bekijk op {site.domain} <ExternalLink size={13} />
                </a>
              </div>
            )}
            {articleNote && status.stage !== "geannuleerd" && status.stage !== "verlopen" && (isHomepage || item.articleBody) && (
              <p className="mb-3 text-xs text-inkSoft">
                {isHomepage ? "Zo komt je link te staan" : "Zo komt je artikel te staan"} · {articleNote}
              </p>
            )}

            {isHomepage ? (
              <div className="rounded-xl border border-line p-4 text-sm">
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
              <ArticlePreview
                title={item.articleTitle}
                html={item.articleBody}
                imageUrl={item.articleImageKey ? `/api/article-images/${item.articleImageKey}` : null}
                excerpt={articleExcerpt(item.articleBody)}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-inkSoft">
                {item.writeForMe
                  ? "We schrijven je artikel. Zodra het klaar is, zie je het hier."
                  : "Het artikel is nog niet aangeleverd."}
              </p>
            )}
          </Card>

          <Card title="Reacties" id="reacties">
            <MessageThread
              orderItemId={item.id}
              messages={item.messages.map((m) => ({
                id: m.id,
                mine: !m.fromAdmin,
                author: m.fromAdmin ? "Nugevonden" : "Jij",
                time: messageTime(m.createdAt),
                body: m.body,
              }))}
              sendAction={sendCustomerMessageAction}
              unread={item.messages.some((m) => m.fromAdmin && !m.readAt)}
              markReadAction={markCustomerMessagesReadAction}
              placeholder="Stel een vraag of geef een reactie..."
              note="We reageren zo snel mogelijk. Ons antwoord zie je hier en op je dashboard."
              empty="Vraag of opmerking over deze link? Laat het ons hier weten."
            />
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title="Gegevens">
            <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-inkSoft">{label}</dt>
                  <dd className="text-ink break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {renewable && (
            <Card title="Verlengen" id="verlengen" className="border-brand/40">
              <p className="text-sm text-ink/80 mb-4">
                Je link blijft gewoon staan. De nieuwe periode gaat in op de huidige einddatum, dus eerder verlengen kost je
                niets extra.
              </p>
              <RenewPanel orderItemId={item.id} options={renewOptions} inCartYears={inCart?.durationYears ?? null} />
            </Card>
          )}

          {status.stage === "verlopen" && (
            <Card title="Opnieuw bestellen">
              <p className="text-sm text-ink/80">
                Deze link is verlopen en offline gehaald.{" "}
                {item.websiteProduct.isAvailable && site.status === "ACTIVE"
                  ? `Wil je weer een link op ${site.domain}? Voeg hem opnieuw toe.`
                  : `${site.domain} biedt dit op dit moment niet meer aan.`}
              </p>
              {item.websiteProduct.isAvailable && site.status === "ACTIVE" && (
                <div className="mt-3 flex justify-start">
                  <AddToCartButton websiteProductId={item.websiteProductId} />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
