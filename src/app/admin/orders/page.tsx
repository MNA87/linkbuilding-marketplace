import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/upload";
import { isWordPressConfigured } from "@/lib/wordpress";
import StatusBadge from "@/components/StatusBadge";
import PublishForm from "./PublishForm";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: { not: "NEW" } } },
    include: {
      order: { include: { customer: { include: { company: true } } } },
      websiteProduct: { include: { website: true } },
      placement: true,
    },
    orderBy: { order: { createdAt: "desc" } },
    take: 100,
  });

  const attachmentUrls = new Map<string, string>();
  for (const item of items) {
    if (!item.uploadedFileUrl) continue;
    try {
      attachmentUrls.set(item.id, await getSignedDownloadUrl(item.uploadedFileUrl));
    } catch (err) {
      console.error("Kon geen signed URL genereren voor bijlage", item.id, err);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Orders</h1>
      <p className="text-sm text-inkSoft mb-6">{items.length} order-item(s), meest recent eerst</p>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-surface border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-ink">{item.websiteProduct.website.domain}</div>
                <div className="text-xs text-inkSoft">
                  {item.order.customer.company?.name ?? item.order.customer.name} &middot;{" "}
                  {item.order.createdAt.toLocaleDateString("nl-NL")}
                </div>
              </div>
              <StatusBadge status={item.order.status} />
            </div>
            <div className="text-sm text-inkSoft">Doel-URL: {item.targetUrl}</div>
            <div className="text-sm text-inkSoft">Ankertekst: {item.anchorText}</div>
            {item.wpCategoryNameSnap && (
              <div className="text-sm text-inkSoft">Categorie: {item.wpCategoryNameSnap}</div>
            )}
            {item.contentSource === "CUSTOMER" ? (
              <div className="mt-2 text-sm bg-brandSoft/50 rounded-md p-3">
                <div className="font-medium text-ink">{item.articleTitle}</div>
                {item.articleImageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/article-images/${item.articleImageKey}`}
                    alt=""
                    className="mt-2 max-h-48 rounded-md border border-line"
                  />
                )}
                <div className="text-inkSoft prose-content mt-1" dangerouslySetInnerHTML={{ __html: item.articleBody ?? "" }} />
              </div>
            ) : (
              <div className="mt-2 text-sm text-inkSoft italic">Content nog aan te leveren.</div>
            )}
            {item.comments && <div className="mt-2 text-sm text-inkSoft">Opmerking: {item.comments}</div>}
            {attachmentUrls.has(item.id) && (
              <a
                href={attachmentUrls.get(item.id)}
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
              ) : (
                <PublishForm
                  orderItemId={item.id}
                  wordpressConfigured={
                    Boolean(item.websiteProduct.website.wpSyncSecret) ||
                    isWordPressConfigured(item.websiteProduct.website)
                  }
                  syncMode={Boolean(item.websiteProduct.website.wpSyncSecret)}
                  initiallyQueued={item.readyToPublish}
                />
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
            Nog geen betaalde orders.
          </div>
        )}
      </div>
    </div>
  );
}
