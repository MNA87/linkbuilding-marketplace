import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

export type PriceResult = {
  supplierPrice: Decimal;
  customerPrice: Decimal;
  marginPercent: Decimal;
};

// The price an admin sets on a product IS the price the customer pays —
// no automatic markup on top. This only holds while the platform sells
// the operator's own sites; the margin-rule machinery (PricingRule) stays
// in the schema/admin for when a real third-party-publisher margin is
// needed again, it's just not applied here anymore.
export async function computePriceForWebsiteProduct(websiteProductId: string): Promise<PriceResult> {
  const websiteProduct = await prisma.websiteProduct.findUniqueOrThrow({
    where: { id: websiteProductId },
  });

  return {
    supplierPrice: websiteProduct.supplierPrice,
    customerPrice: websiteProduct.supplierPrice,
    marginPercent: new Decimal(0),
  };
}
