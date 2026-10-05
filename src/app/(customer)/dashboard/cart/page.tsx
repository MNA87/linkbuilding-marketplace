import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NL_VAT_RATE, vatTreatment } from "@/lib/vatRules";
import CartList from "./CartList";
import { consolidateCarts } from "@/lib/cart";
import MyDetailsForm from "../account/MyDetailsForm";
import { detailsOf } from "../account/details";
import { billingDetailsComplete } from "@/lib/invoices";
import { addYears, durationLabel, hasPeriod } from "@/lib/placementPeriod";
import { itemNeedsContent, itemPrice } from "@/lib/writingService";
import { offerSummary } from "@/lib/customerOverview";

export const metadata: Metadata = { title: "Winkelmandje" };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; afrekenen?: string }>;
}) {
  const { checkout, afrekenen } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  await consolidateCarts(session.user.id);
  const carts = await prisma.order.findMany({
    where: { customerId: session.user.id, status: "NEW" },
    include: {
      project: true,
      items: {
        include: {
          websiteProduct: { include: { website: true, product: true } },
          renewsOrderItem: { include: { placement: true } },
        },
        // Same order as the fill-in sequence (see the order form page).
        orderBy: { id: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const offer = await offerSummary(session.user.companyId);
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { company: true } });
  const company = user?.company ?? null;
  const needsBillingDetails = carts.length > 0 && company !== null && !billingDetailsComplete(company);

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Winkelmandje</h1>

      {!stripeConfigured && carts.some((c) => c.items.length > 0) && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Testmodus: Stripe is nog niet ingesteld, dus &quot;Afrekenen&quot; simuleert de betaling — er wordt niets echt
          in rekening gebracht.
        </div>
      )}

      {checkout === "cancelled" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Betaling geannuleerd. Je mandje staat nog klaar.
        </div>
      )}

      <CartList
        testMode={!stripeConfigured}
        autoConfirm={afrekenen === "1"}
        offerSites={{ BLOG_POST: offer.BLOG_POST.sites, HOMEPAGE_LINK: offer.HOMEPAGE_LINK.sites }}
        vat={company ? vatTreatment(company) : { rate: NL_VAT_RATE, note: null }}
        billingForm={
          needsBillingDetails && user && company ? (
            // The same form as Account → Mijn gegevens, asked once.
            <MyDetailsForm
              initial={detailsOf(user, company)}
              title="Je gegevens voor de factuur"
              description="Vul ze eenmalig in, daarna kun je afrekenen. Later wijzigen kan onder Account."
              submitLabel="Opslaan en verder"
            />
          ) : null
        }
        carts={carts.map((cart) => ({
          id: cart.id,
          items: cart.items.map((item) => {
            const isHomepageLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
            const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });
            const renewedUntil = item.renewsOrderItem?.placement?.expiresAt;
            // A blog article is bought for good — no period to show.
            const periodic = hasPeriod(item.websiteProduct.product.type);
            return {
              id: item.id,
              websiteProductId: item.websiteProductId,
              productName: item.renewsOrderItemId
                ? `Verlenging ${item.websiteProduct.product.name.toLowerCase()}`
                : item.websiteProduct.product.name,
              domain: item.websiteProduct.website.domain,
              title: isHomepageLink
                ? item.anchorText
                : item.writeForMe
                  ? `Wij schrijven · ${item.anchorText ?? ""}`
                  : item.articleTitle,
              hasContent: !itemNeedsContent(item, item.websiteProduct.product.type),
              isRenewal: Boolean(item.renewsOrderItemId),
              period: item.renewsOrderItemId
                ? `+${durationLabel(item.durationYears)}`
                : periodic
                  ? durationLabel(item.durationYears)
                  : "Blijft online",
              online: item.renewsOrderItemId
                ? renewedUntil
                  ? `Loopt nu tot ${nlDate(renewedUntil)}`
                  : "—"
                : item.publishAt
                  ? periodic
                    ? `${nlDate(item.publishAt)} t/m ${nlDate(addYears(item.publishAt, item.durationYears))}`
                    : `Vanaf ${nlDate(item.publishAt)}`
                  : "Direct na betaling",
              price: itemPrice(item).toNumber(),
            };
          }),
        }))}
      />
    </div>
  );
}
