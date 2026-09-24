import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CartList from "./CartList";
import BillingDetailsForm from "@/components/BillingDetailsForm";
import { billingDetailsComplete } from "@/lib/invoices";
import { durationLabel } from "@/lib/placementPeriod";

export const metadata: Metadata = { title: "Winkelmandje" };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const carts = await prisma.order.findMany({
    where: { customerId: session.user.id, status: "NEW" },
    include: {
      project: true,
      items: { include: { websiteProduct: { include: { website: true, product: true } }, renewsOrderItem: { include: { placement: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const company = session.user.companyId
    ? await prisma.company.findUnique({ where: { id: session.user.companyId } })
    : null;
  const needsBillingDetails = carts.length > 0 && company !== null && !billingDetailsComplete(company);

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Winkelmandje</h1>

      {!stripeConfigured && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Testmodus: Stripe is nog niet ingesteld, dus &quot;Afrekenen&quot; simuleert de betaling — er wordt
          niets echt in rekening gebracht.
        </div>
      )}

      {checkout === "cancelled" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Betaling geannuleerd. Je mandje staat nog klaar.
        </div>
      )}

      <CartList
        testMode={!stripeConfigured}
        billingForm={
          needsBillingDetails && company ? (
            <div className="mb-6 bg-surface border border-amber-200 rounded-lg p-4">
              <h2 className="font-medium text-ink mb-1">Factuurgegevens</h2>
              <p className="text-sm text-inkSoft mb-3">
                Vul eenmalig het adres voor je factuur in, daarna kun je afrekenen.
              </p>
              <BillingDetailsForm company={company} />
            </div>
          ) : null
        }
        carts={carts.map((cart) => ({
          id: cart.id,
          projectName: cart.project.name,
          items: cart.items.map((item) => {
            const isHomepageLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
            const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });
            return {
              id: item.id,
              websiteProductId: item.websiteProductId,
              domain: item.websiteProduct.website.domain,
              anchorText: item.anchorText,
              hasContent: isHomepageLink ? Boolean(item.targetUrl) : Boolean(item.articleTitle),
              isHomepageLink,
              isRenewal: Boolean(item.renewsOrderItemId),
              price: item.customerPriceSnap.toNumber(),
              details: item.renewsOrderItemId
                ? `+${durationLabel(item.durationYears)}${
                    item.renewsOrderItem?.placement?.expiresAt
                      ? ` · loopt nu tot ${nlDate(item.renewsOrderItem.placement.expiresAt)}`
                      : ""
                  }`
                : `${durationLabel(item.durationYears)} · ${
                    item.publishAt ? `online op ${nlDate(item.publishAt)}` : "direct online"
                  }`,
            };
          }),
        }))}
      />
    </div>
  );
}
