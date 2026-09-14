import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/upload";
import StatusBadge from "@/components/StatusBadge";
import PublishForm from "./PublishForm";

export default async function SupplierOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) redirect("/login");

  const items = await prisma.orderItem.findMany({
    where: {
      websiteProduct: { website: { companyId: session.user.companyId } },
      order: { status: { not: "NEW" } },
    },
    include: {
      order: true,
      websiteProduct: { include: { website: true } },
      placement: true,
    },
    orderBy: { order: { createdAt: "desc" } },
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
      <p className="text-sm text-inkSoft mb-6">{items.length} betaalde order(s) voor jouw websites</p>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-surface border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-ink">{item.websiteProduct.website.domain}</div>
              <StatusBadge status={item.order.status} />
            </div>
            <div className="text-sm text-inkSoft">Doel-URL: {item.targetUrl}</div>
            <div className="text-sm text-inkSoft">Ankertekst: {item.anchorText}</div>
            {item.contentSource === "CUSTOMER" ? (
              <div className="mt-2 text-sm bg-brandSoft/50 rounded-md p-3">
                <div className="font-medium text-ink">{item.articleTitle}</div>
                <div className="text-inkSoft whitespace-pre-wrap mt-1">{item.articleBody}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-inkSoft italic">Jij levert de content aan.</div>
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
                <PublishForm orderItemId={item.id} />
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
