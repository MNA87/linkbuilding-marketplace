import { describe, it, expect, vi, beforeAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

const findUniqueOrThrow = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    websiteProduct: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args) },
    pricingRule: { findFirst: (...args: unknown[]) => findFirst(...args) },
  },
}));

let computePriceForWebsiteProduct: typeof import("./pricing").computePriceForWebsiteProduct;

beforeAll(async () => {
  ({ computePriceForWebsiteProduct } = await import("./pricing"));
});

describe("computePriceForWebsiteProduct", () => {
  it("falls back to the 30% default margin when no rule exists", async () => {
    findUniqueOrThrow.mockResolvedValue({
      supplierPrice: new Decimal(100),
      website: { categoryId: "cat1" },
    });
    findFirst.mockResolvedValue(null);

    const result = await computePriceForWebsiteProduct("wp1");
    expect(result.customerPrice.toNumber()).toBeCloseTo(130);
    expect(result.marginPercent.toNumber()).toBe(30);
  });

  it("applies a category default margin when set", async () => {
    findUniqueOrThrow.mockResolvedValue({
      supplierPrice: new Decimal(100),
      website: { categoryId: "cat1" },
    });
    findFirst.mockResolvedValue({
      manualCustomerPrice: null,
      defaultMarginPercent: new Decimal(50),
    });

    const result = await computePriceForWebsiteProduct("wp1");
    expect(result.customerPrice.toNumber()).toBeCloseTo(150);
    expect(result.marginPercent.toNumber()).toBe(50);
  });

  it("a manual customer price always wins over the percentage margin", async () => {
    findUniqueOrThrow.mockResolvedValue({
      supplierPrice: new Decimal(100),
      website: { categoryId: "cat1" },
    });
    findFirst.mockResolvedValue({
      manualCustomerPrice: new Decimal(999),
      defaultMarginPercent: new Decimal(50),
    });

    const result = await computePriceForWebsiteProduct("wp1");
    expect(result.customerPrice.toNumber()).toBe(999);
  });
});
