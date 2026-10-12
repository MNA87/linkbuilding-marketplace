import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/databaseBackup", () => ({ backupNow: vi.fn(), storageConfigured: () => true }));

import { resetTestdata, stripeLive } from "./testdataReset";

const original = process.env.STRIPE_SECRET_KEY;
afterEach(() => {
  process.env.STRIPE_SECRET_KEY = original;
});

describe("testdata wissen", () => {
  it("is only possible while Stripe is in test mode", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(stripeLive()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_live_123";
    expect(stripeLive()).toBe(true);
    process.env.STRIPE_SECRET_KEY = "rk_live_123";
    expect(stripeLive()).toBe(true);
  });

  it("refuses with a live key before touching anything", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_123";
    await expect(resetTestdata()).rejects.toThrow("Stripe staat live");
  });
});
