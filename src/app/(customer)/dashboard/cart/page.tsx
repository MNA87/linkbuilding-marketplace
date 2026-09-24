import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CartItemRow from "./CartItemRow";
import CheckoutButton from "./CheckoutButton";
import BillingDetailsForm from "@/components/BillingDetailsForm";
import { billingDetailsComplete } from "@/lib/invoices";
import { VAT_RATE, vatTotals } from "@/lib/vat";
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
      <p className="text-sm text-inkSoft mb-6">
        {carts.reduce((sum, c) => sum + c.items.length, 0)} item(s) klaar om af te rekenen
      </p>

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

      {carts.length === 0 && (
        <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
          Je winkelmandje is leeg.{" "}
          <Link href="/marketplace" className="text-brand hover:underline">
            Bekijk de marketplace
          </Link>
          .
        </div>
      )}

      {needsBillingDetails && company && (
        <div className="mb-6 bg-surface border border-amber-200 rounded-lg p-4">
          <h2 className="font-medium text-ink mb-1">Factuurgegevens</h2>
          <p className="text-sm text-inkSoft mb-3">
            Vul eenmalig het adres voor je factuur in, daarna kun je afrekenen.
          </p>
          <BillingDetailsForm company={company} />
        </div>
      )}

      <div className="space-y-6">
        {carts.map((cart) => {
          const totals = vatTotals(
            cart.items.map((i) => i.customerPriceSnap),
            VAT_RATE
          );
          return (
            <div key={cart.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="font-medium text-ink mb-3">{cart.project.name}</div>
              <div className="space-y-2 mb-4">
                {cart.items.map((item) => {
                  const isHomepageLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
                  return (
                    <CartItemRow
                      key={item.id}
                      orderItemId={item.id}
                      websiteProductId={item.websiteProductId}
                      domain={item.websiteProduct.website.domain}
                      anchorText={item.anchorText}
                      hasContent={isHomepageLink ? Boolean(item.targetUrl) : Boolean(item.articleTitle)}
                      isHomepageLink={isHomepageLink}
                      price={item.customerPriceSnap.toFixed(2)}
                      isRenewal={Boolean(item.renewsOrderItemId)}
                      details={
                        item.renewsOrderItemId
                          ? `+${durationLabel(item.durationYears)}${
                              item.renewsOrderItem?.placement?.expiresAt
                                ? ` · loopt nu tot ${item.renewsOrderItem.placement.expiresAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}`
                                : ""
                            }`
                          : `${durationLabel(item.durationYears)} · ${
                              item.publishAt
                                ? `online op ${item.publishAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}`
                                : "direct online"
                            }`
                      }
                    />
                  );
                })}
              </div>
              <div className="flex items-end justify-between gap-4 pt-3 border-t border-line">
                <div className="text-sm text-inkSoft space-y-0.5">
                  <div>Subtotaal excl. BTW: &euro;{totals.subtotal.toFixed(2)}</div>
                  <div>BTW {VAT_RATE}%: &euro;{totals.vat.toFixed(2)}</div>
                  <div>
                    Totaal: <span className="text-ink font-medium">&euro;{totals.total.toFixed(2)}</span>
                  </div>
                </div>
                <CheckoutButton orderId={cart.id} testMode={!stripeConfigured} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
