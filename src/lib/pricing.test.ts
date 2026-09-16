import { describe, it, expect, vi, beforeAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

const findUniqueOrThrow = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    websiteProduct: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args) },
  },
}));

let computePriceForWebsiteProduct: typeof import("./pricing").computePriceForWebsiteProduct;

beforeAll(async () => {
  ({ computePriceForWebsiteProduct } = await import("./pricing"));
});

describe("computePriceForWebsiteProduct", () => {
  it("the customer price always equals the admin-set price, no markup", async () => {
    findUniqueOrThrow.mockResolvedValue({ supplierPrice: new Decimal(100) });

    const result = await computePriceForWebsiteProduct("wp1");
    expect(result.customerPrice.toNumber()).toBe(100);
    expect(result.supplierPrice.toNumber()).toBe(100);
    expect(result.marginPercent.toNumber()).toBe(0);
  });
});
