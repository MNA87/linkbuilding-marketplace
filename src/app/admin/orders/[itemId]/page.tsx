import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/upload";
import { isWordPressConfigured } from "@/lib/wordpress";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import StatusBadge from "@/components/StatusBadge";
import PublishForm from "../PublishForm";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      order: { include: { customer: { include: { company: true } } } },
      websiteProduct: { include: { website: true } },
      placement: true,
    },
  });
  if (!item) notFound();

  let attachmentUrl: string | null = null;
  if (item.uploadedFileUrl) {
    try {
      attachmentUrl = await getSignedDownloadUrl(item.uploadedFileUrl);
    } catch (err) {
      console.error("Kon geen signed URL genereren voor bijlage", item.id, err);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/orders" className="text-sm text-brand hover:underline">
        &larr; Terug naar Orders
      </Link>

      <div className="bg-surface border border-line rounded-lg p-4 mt-3">
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
        {item.targetUrl && <div className="text-sm text-inkSoft">Doel-URL: {item.targetUrl}</div>}
        {item.anchorText && <div className="text-sm text-inkSoft">Ankertekst: {item.anchorText}</div>}
        {!item.targetUrl && <div className="text-sm text-inkSoft italic">Geen link.</div>}
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
                className="mt-2 max-h-48 max-w-full rounded-md border border-line"
              />
            )}
            <div className="text-inkSoft prose-content mt-1" dangerouslySetInnerHTML={{ __html: item.articleBody ?? "" }} />
          </div>
        ) : (
          <div className="mt-2 text-sm text-inkSoft italic">Content nog aan te leveren.</div>
        )}
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
    </div>
  );
}
