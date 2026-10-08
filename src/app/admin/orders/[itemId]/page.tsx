import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/upload";
import { isWordPressConfigured } from "@/lib/wordpress";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import { STAGE_STYLES, linkStatus } from "@/lib/customerOrders";
import { adminLinkStatus } from "@/lib/adminOrders";
import PublishForm from "../PublishForm";
import EditItemForm from "../EditItemForm";
import { articleSlugOf, articleUrlPrefix } from "@/lib/wpSlug";
import { mailSnippet } from "@/lib/inboundParse";
import RemoveWritingFeeButton from "../RemoveWritingFeeButton";
import CancelOrderButton from "../CancelOrderButton";
import ReturnToInboxButton from "../ReturnToInboxButton";
import ChangeWebsiteForm from "../ChangeWebsiteForm";
import { ADMIN_CANCELLABLE_STATUSES } from "@/lib/orderCancel";
import { vatTotals } from "@/lib/vat";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { articleWriterConfigured } from "@/lib/articleWriter";
import { pixabayConfigured } from "@/lib/pixabay";
import MessageThread from "@/components/MessageThread";
import { messageTime } from "@/lib/orderMessages";
import { adminMarkMessagesReadAction, adminSendMessageAction } from "../actions";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      order: {
        include: {
          customer: { include: { company: true } },
          messages: { orderBy: { createdAt: "asc" } },
          _count: { select: { items: true } },
          items: { select: { customerPriceSnap: true, writingFeeSnap: true } },
        },
      },
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
      inboundMails: { orderBy: { receivedAt: "asc" } },
      outboundMails: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!item) notFound();
  const customerName = item.order.customer.company?.name ?? item.order.customer.name;
  const isHomepageLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
  const briefLinks = item.writeForMe ? parseBriefLinks(item.briefLinks) : [];
  const hasArticle = Boolean(item.articleTitle && item.articleBody);
  const canReturnToInbox =
    item.order.onAccount &&
    !item.placement &&
    !item.order.collectiveInvoiceId &&
    item.inboundMails.some((m) => !m.isReply);
  const writingFee = `€${item.writingFeeSnap.toFixed(2).replace(".", ",")}`;
  // Paid before the customer filled it in ("Nu betalen, later aanleveren").
  const awaitingContent = isAwaitingContent(item, item.order.status, item.websiteProduct.product.type);
  const website = item.websiteProduct.website;
  // Where the link stands, in the words the customer sees too.
  const status = adminLinkStatus(
    item.renewsOrderItemId,
    linkStatus({
      ...item,
      orderStatus: item.order.status,
      periodic: item.periodic,
      needsContent: awaitingContent,
    })
  );
  const syncMode = Boolean(website.wpSyncSecret);
  const closed = ["NEW", "CANCELLED", "REJECTED", "REFUND_REQUESTED"].includes(item.order.status);
  // Before it's online the site can still change (the wrong one chosen).
  const otherSites =
    !closed && !item.placement
      ? (
          await prisma.websiteProduct.findMany({
            where: { product: { type: item.websiteProduct.product.type } },
            select: { website: { select: { id: true, domain: true } } },
            orderBy: { website: { domain: "asc" } },
          })
        ).map((p) => p.website)
      : null;
  const queued = item.readyToPublish && !item.placement;
  // Checked and changed here before it goes out; once it's on the site only
  // via the plugin, which takes over the new version.
  const editable =
    !closed &&
    !awaitingContent &&
    !queued &&
    item.placement?.status !== "expired" &&
    (!item.placement || syncMode) &&
    (isHomepageLink || item.writeForMe || hasArticle);
  const canPublish = isHomepageLink ? syncMode : syncMode || isWordPressConfigured(website);
  // What comes before the slug: "https://a2f.nl/", or the fixed start of
  // the URLs on nugevonden.nl and enqueteplein.nl.
  const urlPrefix = articleUrlPrefix(
    website.wpHomeUrl,
    website.wpPermalinkStructure,
    item.wpCategoryNameSnap,
    website.articleUrlBase
  );

  const when = (d: Date) =>
    d.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
  // The mail it came in by and the previews sent, as one thread.
  const originMail = item.inboundMails.find((m) => !m.isReply) ?? null;
  const thread = [
    ...item.inboundMails.map((m) => ({ at: m.receivedAt, mine: false, mail: m, out: null })),
    ...item.outboundMails.map((m) => ({ at: m.sentAt, mine: true, mail: null, out: m })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const waitingForApproval = Boolean(item.previewSentAt && !item.placement && !item.readyToPublish);

  let attachmentUrl: string | null = null;
  if (item.uploadedFileUrl) {
    try {
      attachmentUrl = await getSignedDownloadUrl(item.uploadedFileUrl);
    } catch (err) {
      console.error("Kon geen signed URL genereren voor bijlage", item.id, err);
    }
  }

  return (
    <div className="max-w-6xl">
      <Link href="/admin/orders" className="text-sm text-brand hover:underline">
        &larr; Terug naar Orders
      </Link>

      <div className="mt-3 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
        <div className="bg-surface border border-line rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-medium text-ink">
                Order #{item.order.orderNumber} &middot; {item.websiteProduct.website.domain}
              </div>
              {otherSites && (
                <ChangeWebsiteForm
                  orderItemId={item.id}
                  current={{ id: item.websiteProduct.websiteId, domain: item.websiteProduct.website.domain }}
                  websites={otherSites}
                  repriced={item.order.onAccount && !item.order.collectiveInvoiceId}
                />
              )}
              <div className="text-xs text-inkSoft">
                {item.order.customer.company?.name ?? item.order.customer.name} &middot;{" "}
                {item.order.createdAt.toLocaleString("nl-NL", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Amsterdam",
                })}
                {item.order.onAccount && " · via mail · op rekening (verzamelfactuur)"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.order.customer.email === TEST_CUSTOMER_EMAIL && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">TEST</span>
              )}
              {waitingForApproval && (
                <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Wacht op akkoord klant
                </span>
              )}
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}
              >
                {status.label}
              </span>
            </div>
          </div>
          {/* The customer's "Op een datum", while it hasn't gone out yet. */}
          {!item.placement && item.publishAt && item.publishAt > new Date() && (
            <div className="text-sm text-inkSoft">
              De klant koos een datum: online op{" "}
              {item.publishAt.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                timeZone: "Europe/Amsterdam",
              })}
              .
            </div>
          )}
          {awaitingContent && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong className="font-semibold">Wacht op de klant.</strong> Betaald, maar de inhoud is nog niet
              aangeleverd. De klant krijgt herinneringen (na 3, 7 en 30 dagen); jij krijgt een mail zodra het binnen is.
            </div>
          )}
          {item.writeForMe ? (
            <div className="mt-2 text-sm rounded-md border border-brand/30 bg-brandSoft/40 p-3">
              <div className="font-medium text-ink mb-1">Laat ons schrijven — briefing van de klant</div>
              <ol className="list-decimal pl-5 text-inkSoft space-y-0.5">
                {briefLinks.map((l) => (
                  <li key={l.url}>
                    <span className="text-ink">&ldquo;{l.anchor}&rdquo;</span> → {l.url}
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 text-inkSoft">
                Schrijfkosten:{" "}
                {item.writingFeeSnap.isZero() ? (
                  <span className="text-ink">inbegrepen</span>
                ) : (
                  <>
                    <span className="text-ink">{writingFee}</span>
                    {item.order.onAccount && !item.order.collectiveInvoiceId && (
                      <RemoveWritingFeeButton orderItemId={item.id} fee={writingFee} />
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
          {item.topicNameSnap && <div className="text-sm text-inkSoft">Onderwerp: {item.topicNameSnap}</div>}
          {item.wpCategoryNameSnap && <div className="text-sm text-inkSoft">Categorie: {item.wpCategoryNameSnap}</div>}
          {editable ? (
            <div className="mt-4 border-t border-line pt-4">
              <EditItemForm
                orderItemId={item.id}
                live={Boolean(item.placement)}
                canPublish={canPublish}
                updatePending={item.updatePending}
                {...(isHomepageLink
                  ? {
                      link: {
                        anchorText: item.anchorText ?? "",
                        targetUrl: item.targetUrl ?? "",
                        nofollow: item.nofollow,
                      },
                    }
                  : {
                      article: {
                        title: item.articleTitle ?? "",
                        slug: item.articleSlug ? articleSlugOf(item) : "",
                        body: item.articleBody ?? "",
                        imageKey: item.articleImageKey ?? "",
                      },
                      urlPrefix,
                      writeForMe: item.writeForMe,
                      links: briefLinks,
                      aiEnabled: articleWriterConfigured(),
                      photoSearchEnabled: pixabayConfigured(),
                      preview: item.placement
                        ? null
                        : {
                            version: item.previewVersion,
                            sentAt: item.previewSentAt ? when(item.previewSentAt) : null,
                            to: originMail?.fromEmail || item.order.customer.email,
                          },
                    })}
              />
            </div>
          ) : hasArticle ? (
            <div className="mt-2 text-sm bg-brandSoft/50 rounded-md p-3">
              <div className="font-medium text-ink">{item.articleTitle}</div>
              {item.articleImageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/article-images/${item.articleImageKey}`}
                  alt=""
                  className="mt-2 max-h-48 max-w-full rounded-md border border-line"
                />
              )}
              <div
                className="text-inkSoft prose-content mt-1"
                dangerouslySetInnerHTML={{ __html: item.articleBody ?? "" }}
              />
            </div>
          ) : !isHomepageLink ? (
            <div className="mt-2 text-sm text-inkSoft italic">Content nog aan te leveren.</div>
          ) : null}
          {item.comments && <div className="mt-2 text-sm text-inkSoft">Opmerking: {item.comments}</div>}
          {attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-brand hover:underline"
            >
              Download bijlage
            </a>
          )}

          {/* Only when there's something to say: live, a draft, or queued. */}
          {(item.placement || (queued && !closed)) && (
            <div className="mt-3 pt-3 border-t border-line">
              {item.placement?.liveUrl ? (
                <a
                  href={item.placement.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  Live: {item.placement.liveUrl}
                </a>
              ) : item.placement?.status === "draft" ? (
                <div className="text-sm text-amber-700">
                  Concept staat klaar in WordPress — publiceer &apos;m daar om de live link hier te krijgen.
                </div>
              ) : closed ? null : (
                <PublishForm
                  orderItemId={item.id}
                  syncMode={syncMode}
                  initiallyQueued={item.readyToPublish}
                  plannedFor={
                    item.publishAt && item.publishAt > new Date()
                      ? item.publishAt.toLocaleDateString("nl-NL", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "Europe/Amsterdam",
                        })
                      : undefined
                  }
                />
              )}
            </div>
          )}

          {(canReturnToInbox || ADMIN_CANCELLABLE_STATUSES.includes(item.order.status)) && (
            <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
              {ADMIN_CANCELLABLE_STATUSES.includes(item.order.status) && (
                <CancelOrderButton
                  orderId={item.orderId}
                  orderNumber={item.order.orderNumber}
                  amount={`€${vatTotals(item.order.items.map(itemPrice), item.order.vatRate).total.toFixed(2).replace(".", ",")}`}
                />
              )}
              {/* A mail order made with the wrong site or customer: make it again. */}
              {canReturnToInbox && <ReturnToInboxButton orderItemId={item.id} />}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
        {thread.length > 0 && (
          <section className="bg-surface border border-line rounded-lg p-4">
            <h2 className="font-serif text-lg text-ink">Mail met de klant</h2>
            <p className="text-xs text-inkSoft mb-3">
              Via {originMail ? "de mailbox, in dezelfde mailwisseling" : "de mailbox"} met{" "}
              {originMail?.fromEmail ?? item.order.customer.email}.
            </p>
            <div className="space-y-2 text-sm">
              {thread.map((t) =>
                t.mail ? (
                  <Link
                    key={`in-${t.mail.id}`}
                    href={`/admin/binnengekomen/${t.mail.id}`}
                    className="block rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                  >
                    <div className="text-xs text-inkSoft">
                      {t.mail.fromName ?? t.mail.fromEmail} · {when(t.at)}
                      {t.mail.isReply ? " · antwoord" : ""}
                    </div>
                    <div className="line-clamp-4 whitespace-pre-wrap break-words text-ink/90">
                      {mailSnippet(t.mail.text).slice(0, 600) || t.mail.subject}
                    </div>
                  </Link>
                ) : (
                  <div key={`out-${t.out!.id}`} className="ml-6 rounded-lg bg-[var(--pay-soft)] p-3">
                    <div className="text-xs text-inkSoft">Jij · {when(t.at)}</div>
                    Preview versie {t.out!.version} verstuurd (Word-bijlage)
                  </div>
                )
              )}
            </div>
          </section>
        )}
        <section id="berichten" className="scroll-mt-6 bg-surface border border-line rounded-lg p-4">
          <h2 className="font-serif text-lg text-ink">Berichten</h2>
          <p className="text-xs text-inkSoft mb-3">
            Gesprek over order #{item.order.orderNumber}
            {item.order._count.items > 1 ? ` (${item.order._count.items} links)` : ""}
          </p>
          <MessageThread
            orderId={item.orderId}
            messages={item.order.messages.map((m) => ({
              id: m.id,
              mine: m.fromAdmin,
              author: m.fromAdmin ? "Jij" : customerName,
              time: messageTime(m.createdAt),
              body: m.body,
            }))}
            sendAction={adminSendMessageAction}
            unread={item.order.messages.some((m) => !m.fromAdmin && !m.readAt)}
            markReadAction={adminMarkMessagesReadAction}
            placeholder="Typ je bericht aan de klant..."
            note="De klant ziet je bericht in Mijn orders en op zijn dashboard."
            empty="Nog geen berichten. Je kunt de klant hier een bericht sturen."
          />
        </section>
        </div>
      </div>
    </div>
  );
}
