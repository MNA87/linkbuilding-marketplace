import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { placementDetails } from "@/lib/placementPeriod";
import { getSignedDownloadUrl } from "@/lib/upload";
import { isWordPressConfigured } from "@/lib/wordpress";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import StatusBadge from "@/components/StatusBadge";
import PublishForm from "../PublishForm";
import WriteArticleForm from "../WriteArticleForm";
import { parseBriefLinks } from "@/lib/writingService";
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
        },
      },
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
    },
  });
  if (!item) notFound();
  const customerName = item.order.customer.company?.name ?? item.order.customer.name;
  const isHomepageLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
  const briefLinks = item.writeForMe ? parseBriefLinks(item.briefLinks) : [];
  // "Laat ons schrijven": ours to write until it's queued for the site or live.
  const writing = item.writeForMe && !item.readyToPublish && !item.placement;
  const hasArticle = Boolean(item.articleTitle && item.articleBody);

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

      <div className="mt-3 grid items-start gap-5 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
        <div className="bg-surface border border-line rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-medium text-ink">
                Order #{item.order.orderNumber} &middot; {item.websiteProduct.website.domain}
              </div>
              <div className="text-xs text-inkSoft">
                {item.order.customer.company?.name ?? item.order.customer.name} &middot;{" "}
                {item.order.createdAt.toLocaleString("nl-NL", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Amsterdam",
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.order.customer.email === TEST_CUSTOMER_EMAIL && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  TEST
                </span>
              )}
              <StatusBadge status={item.order.status} />
            </div>
          </div>
          <div className="text-sm text-inkSoft">{placementDetails(item)}</div>
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
            </div>
          ) : (
            <>
              {item.targetUrl && <div className="text-sm text-inkSoft">Doel-URL: {item.targetUrl}</div>}
              {item.anchorText && <div className="text-sm text-inkSoft">Ankertekst: {item.anchorText}</div>}
              {!item.targetUrl && <div className="text-sm text-inkSoft italic">Geen link.</div>}
            </>
          )}
          {item.wpCategoryNameSnap && (
            <div className="text-sm text-inkSoft">Categorie: {item.wpCategoryNameSnap}</div>
          )}
          {writing ? (
            <div className="mt-4 pt-4 border-t border-line">
              <WriteArticleForm
                orderItemId={item.id}
                links={briefLinks}
                initialTitle={item.articleTitle ?? ""}
                initialBody={item.articleBody ?? ""}
                initialImageKey={item.articleImageKey ?? ""}
                aiEnabled={articleWriterConfigured()}
                photoSearchEnabled={pixabayConfigured()}
              />
            </div>
          ) : item.contentSource === "CUSTOMER" || (item.writeForMe && hasArticle) ? (
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
              <div className="text-inkSoft prose-content mt-1" dangerouslySetInnerHTML={{ __html: item.articleBody ?? "" }} />
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
            ) : item.writeForMe && !hasArticle ? (
              <div className="text-sm text-inkSoft">Schrijf en sla eerst het artikel op, daarna kun je het publiceren.</div>
            ) : (
              <PublishForm
                orderItemId={item.id}
                wordpressConfigured={
                  Boolean(item.websiteProduct.website.wpSyncSecret) ||
                  isWordPressConfigured(item.websiteProduct.website)
                }
                syncMode={Boolean(item.websiteProduct.website.wpSyncSecret)}
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
        </div>

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
  );
}
