import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { customerTerms, priceForCustomer, type PriceSource } from "@/lib/customerPricing";

export type PriceResult = {
  supplierPrice: Decimal;
  customerPrice: Decimal;
  marginPercent: Decimal;
  // The product's own price, and where customerPrice comes from.
  standardPrice: Decimal;
  source: PriceSource;
};

// The price an admin sets on a product IS the price the customer pays —
// no automatic markup on top. This only holds while the platform sells
// the operator's own sites; the margin-rule machinery (PricingRule) stays
// in the schema/admin for when a real third-party-publisher margin is
// needed again, it's just not applied here anymore.
// With a customer, the prices agreed with them apply (see
// src/lib/customerPricing.ts); supplier and customer price stay equal.
export async function computePriceForWebsiteProduct(
  websiteProductId: string,
  companyId?: string | null
): Promise<PriceResult> {
  const websiteProduct = await prisma.websiteProduct.findUniqueOrThrow({
    where: { id: websiteProductId },
  });
  const { price, source } = priceForCustomer(
    websiteProduct.supplierPrice,
    websiteProductId,
    await customerTerms(companyId)
  );

  return {
    supplierPrice: price,
    customerPrice: price,
    marginPercent: new Decimal(0),
    standardPrice: websiteProduct.supplierPrice,
    source,
  };
}
