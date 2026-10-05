import { Prisma } from "@prisma/client";
import { TopicNotOfferedError, computePriceForWebsiteProduct } from "@/lib/pricing";
import { yearlyPrice } from "@/lib/placementPeriod";

// A renewal's extra years start where the current period ends — or today,
// if that end has already passed — so renewing early costs nothing extra.
export function renewalStart(expiresAt: Date | null, now = new Date()): Date {
  return expiresAt && expiresAt > now ? expiresAt : now;
}

export type YearlyPrices = { supplier: Prisma.Decimal; customer: Prisma.Decimal; margin: Prisma.Decimal };

// What one extra year costs: the current price per year while the product
// is still on sale (with the prices agreed with the customer), else what was
// paid per year last time.
export async function renewalYearlyPrices(
  original: {
  websiteProductId: string;
  websiteProduct: { isAvailable: boolean };
  topicId: string | null;
  supplierPriceSnap: Prisma.Decimal;
  customerPriceSnap: Prisma.Decimal;
  marginSnap: Prisma.Decimal;
  durationYears: number;
  },
  companyId?: string | null
): Promise<YearlyPrices> {
  // Same topic as before; a site that no longer places it keeps what was paid.
  const current = original.websiteProduct.isAvailable
    ? await computePriceForWebsiteProduct(original.websiteProductId, companyId, original.topicId).catch((e) => {
        if (e instanceof TopicNotOfferedError) return null;
        throw e;
      })
    : null;
  if (current) {
    return {
      supplier: new Prisma.Decimal(current.supplierPrice),
      customer: new Prisma.Decimal(current.customerPrice),
      margin: new Prisma.Decimal(current.marginPercent),
    };
  }
  return {
    supplier: yearlyPrice(original.supplierPriceSnap, original.durationYears),
    customer: yearlyPrice(original.customerPriceSnap, original.durationYears),
    margin: original.marginSnap,
  };
}
