import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { DURATION_YEARS, addYears, durationLabel, hasPeriod, priceForYears } from "@/lib/placementPeriod";
import { renewalStart, renewalYearlyPrices } from "@/lib/renewal";
import { STAGE_STYLES, linkStatus, nlDate, shortUrl } from "@/lib/customerOrders";
import AddToCartButton from "@/app/(customer)/marketplace/AddToCartButton";
import MessageThread from "@/components/MessageThread";
import { messageTime } from "@/lib/orderMessages";
import RenewPanel, { type RenewOption } from "./RenewPanel";
import { markCustomerMessagesReadAction, sendCustomerMessageAction } from "./actions";

export const metadata: Metadata = { title: "Orderdetails" };

const PAID: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS", "PUBLISHED", "VERIFICATION", "COMPLETED"];

function Card({ title, id, children, className = "" }: { title: string; id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-6 rounded-2xl border bg-surface p-5 ${className || "border-line"}`}>
      <h2 className="font-serif text-lg text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

// One bought link: how far along it is, what was ordered, renewing it, and
// what happened to it so far.
export default async function CustomerLinkPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
      order: {
        include: {
          invoices: { where: { type: "INVOICE" }, orderBy: { issuedAt: "desc" }, take: 1 },
          _count: { select: { items: true } },
        },
      },
      renewals: { include: { order: { select: { status: true, paidAt: true } } } },
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
  const links = item.writeForMe
    ? parseBriefLinks(item.briefLinks)
    : item.anchorText || item.targetUrl
      ? [{ anchor: item.anchorText ?? "", url: item.targetUrl ?? "" }]
      : [];
  const invoice = item.order.invoices[0];

  // Verlengen: +1/+2/+3 years from the current end date.
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

  const history = [
    { at: item.order.createdAt, text: periodic ? `Besteld (${durationLabel(item.durationYears)})` : "Besteld" },
    item.order.paidAt && { at: item.order.paidAt, text: "Betaald" },
    placement?.publishedAt && { at: placement.publishedAt, text: "Live gezet" },
    periodic && placement?.reminderSentAt && { at: placement.reminderSentAt, text: "Herinnering gestuurd: verloopt binnenkort" },
    ...item.renewals
      .filter((r) => PAID.includes(r.order.status) && r.order.paidAt)
      .map((r) => ({ at: r.order.paidAt!, text: `Verlengd met ${durationLabel(r.durationYears)}` })),
    placement?.expiredAt && { at: placement.expiredAt, text: "Verlopen en offline gehaald" },
  ]
    .filter((e): e is { at: Date; text: string } => Boolean(e))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const details: [string, React.ReactNode][] = [["Soort", isHomepage ? "Homepage link" : "Blog link"]];
  if (isHomepage && item.wpCategoryNameSnap) details.push(["Rubriek", item.wpCategoryNameSnap]);
  links.forEach((l, i) =>
    details.push([
      links.length > 1 ? `Link ${i + 1}` : "Link",
      <span key={i}>
        {l.anchor || "—"}
        {l.url && <span className="block text-xs text-inkSoft">→ {shortUrl(l.url)}</span>}
      </span>,
    ])
  );
  if (!isHomepage) details.push(["Artikel", item.articleTitle ?? (item.writeForMe ? "Wij schrijven het artikel" : "—")]);
  details.push([
    "Online",
    placement?.publishedAt
      ? `Sinds ${nlDate(placement.publishedAt)}`
      : item.publishAt
        ? `Gepland op ${nlDate(item.publishAt)}`
        : "Zo snel mogelijk na betaling",
  ]);
  details.push(["Looptijd", periodic ? durationLabel(item.durationYears) : "Blijft online"]);
  if (periodic && placement?.expiresAt) {
    details.push([status.stage === "verlopen" ? "Liep tot" : "Loopt tot", <b key="e">{nlDate(placement.expiresAt)}</b>]);
  }
  details.push(["Bedrag", `€${itemPrice(item).toFixed(2).replace(".", ",")} excl. BTW`]);
  details.push([
    "Order",
    <Link key="o" href={`/dashboard/orders/${item.order.id}`} className="text-brand hover:underline">
      #{item.order.orderNumber} bekijken{item.order._count.items > 1 && ` (${item.order._count.items} links)`}
    </Link>,
  ]);
  if (invoice) {
    details.push([
      "Factuur",
      <a key="f" href={`/api/invoices/${invoice.id}/pdf`} className="text-brand hover:underline">
        {invoice.invoiceNumber} downloaden
      </a>,
    ]);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-inkSoft hover:text-ink">
        <ArrowLeft size={15} />
        Mijn orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">{site.domain}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}>{status.label}</span>
      </div>
      <p className="text-sm text-inkSoft mt-1">
        {isHomepage ? "Homepage link" : "Blog link"} · order #{item.order.orderNumber} · besteld op {nlDate(item.order.createdAt)}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start">
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
              {status.detail && <p className="mt-4 text-sm text-ink/80">{status.detail}.</p>}
            </Card>
          )}

          <Card title="Gegevens">
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-inkSoft">{label}</dt>
                  <dd className="text-ink break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {placement?.liveUrl && status.stage !== "verlopen" && (
              <a
                href={placement.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink/80 hover:bg-gray-50"
              >
                <ExternalLink size={14} />
                Bekijk live {isHomepage ? "link" : "artikel"}
              </a>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {renewable && (
            <Card title="Verlengen" id="verlengen" className="border-brand/40">
              <p className="text-sm text-ink/80 mb-4">
                Je link blijft gewoon staan. De nieuwe periode gaat in op de huidige einddatum, dus eerder verlengen kost je
                niets extra.
              </p>
              <RenewPanel orderItemId={item.id} options={renewOptions} inCartYears={inCart?.durationYears ?? null} />
            </Card>
          )}

          <Card title="Berichten" id="berichten">
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
              placeholder="Stel een vraag over deze link..."
              note="We reageren zo snel mogelijk. Ons antwoord zie je hier en op je dashboard."
              empty="Vraag over deze link? Stuur ons hier een bericht."
            />
          </Card>

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

          <Card title="Geschiedenis">
            <ul className="text-sm">
              {history.map((e, i) => (
                <li key={i} className="flex gap-4 border-t border-line/70 py-2 first:border-t-0 first:pt-0">
                  <span className="w-20 shrink-0 text-inkSoft tabular-nums">{nlDate(e.at)}</span>
                  <span className="text-ink/90">{e.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
