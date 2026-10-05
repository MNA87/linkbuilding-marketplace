import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { customerTerms, priceForCustomer, topicStandardPrice, type PriceSource } from "@/lib/customerPricing";

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
// With a topic (Casino, Lening, ...), the site's price for that topic;
// a site that doesn't place it throws TopicNotOfferedError.
export class TopicNotOfferedError extends Error {
  constructor() {
    super("Deze website plaatst geen links over dit onderwerp.");
  }
}

export async function computePriceForWebsiteProduct(
  websiteProductId: string,
  companyId?: string | null,
  topicId: string | null = null
): Promise<PriceResult> {
  const websiteProduct = await prisma.websiteProduct.findUniqueOrThrow({
    where: { id: websiteProductId },
    include: { topicPrices: { select: { topicId: true, price: true } } },
  });
  const standard = topicStandardPrice(websiteProduct, topicId);
  if (!standard) throw new TopicNotOfferedError();
  const { price, source } = priceForCustomer(standard, websiteProductId, await customerTerms(companyId), topicId);

  return {
    supplierPrice: price,
    customerPrice: price,
    marginPercent: new Decimal(0),
    standardPrice: standard,
    source,
  };
}
