import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

const DEFAULT_MARGIN_PERCENT = 30;

export type PriceResult = {
  supplierPrice: Decimal;
  customerPrice: Decimal;
  marginPercent: Decimal;
};

// Admin can override the margin globally-per-category or per-website-product,
// and can pin an exact manual customer price (which always wins). Falls back
// to a platform-wide default margin when no rule exists yet.
export async function computePriceForWebsiteProduct(websiteProductId: string): Promise<PriceResult> {
  const websiteProduct = await prisma.websiteProduct.findUniqueOrThrow({
    where: { id: websiteProductId },
    include: { website: true },
  });

  const rule = await prisma.pricingRule.findFirst({
    where: {
      OR: [{ websiteProductId }, { categoryId: websiteProduct.website.categoryId }],
    },
    orderBy: { websiteProductId: "desc" }, // a product-specific rule beats a category rule
  });

  const supplierPrice = websiteProduct.supplierPrice;

  if (rule?.manualCustomerPrice) {
    return {
      supplierPrice,
      customerPrice: rule.manualCustomerPrice,
      marginPercent: rule.manualCustomerPrice.sub(supplierPrice).div(supplierPrice).mul(100),
    };
  }

  const marginPercent = rule?.defaultMarginPercent ?? new Decimal(DEFAULT_MARGIN_PERCENT);
  const customerPrice = supplierPrice.mul(marginPercent.div(100).add(1));

  return { supplierPrice, customerPrice, marginPercent };
}
