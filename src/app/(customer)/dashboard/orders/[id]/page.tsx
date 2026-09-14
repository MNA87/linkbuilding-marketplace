import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "../page";

export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { checkout?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { websiteProduct: { include: { website: true } }, placement: true } } },
  });

  // Explicit ownership check — a customer may only ever see their own order.
  if (!order || order.customerId !== session.user.id) notFound();

  return (
    <div className="max-w-2xl">
      {searchParams.checkout === "success" && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          Betaling gelukt. Zodra de bevestiging van Stripe binnen is, zie je de status hieronder op &quot;Betaald&quot;.
        </div>
      )}
      {searchParams.checkout === "cancelled" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Betaling geannuleerd. Je kunt het opnieuw proberen vanuit de marketplace.
        </div>
      )}

      <h1 className="font-serif text-2xl text-ink mb-1">Order {order.id.slice(-8)}</h1>
      <p className="text-sm text-inkSoft mb-6">
        Geplaatst op {order.createdAt.toLocaleDateString("nl-NL")} &middot; <StatusBadge status={order.status} />
      </p>

      <div className="space-y-4">
        {order.items.map((item) => (
          <div key={item.id} className="bg-surface border border-line rounded-lg p-4">
            <div className="font-medium text-ink">{item.websiteProduct.website.domain}</div>
            <div className="text-sm text-inkSoft mt-1">Doel-URL: {item.targetUrl}</div>
            <div className="text-sm text-inkSoft">Ankertekst: {item.anchorText}</div>
            <div className="text-sm text-ink font-medium mt-2">&euro;{item.customerPriceSnap.toFixed(2)}</div>
            {item.placement?.liveUrl && (
              <a
                href={item.placement.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand hover:underline mt-2 inline-block"
              >
                Bekijk live plaatsing
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
