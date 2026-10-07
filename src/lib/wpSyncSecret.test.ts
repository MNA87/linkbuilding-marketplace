import { describe, expect, it } from "vitest";
import { wpSyncSecretOf } from "./wpSyncSecret";

describe("wpSyncSecretOf", () => {
  it("reads the header first, the URL for older plugins", () => {
    const withHeader = new Request("https://x.nl/api/wp-sync/pending", { headers: { "X-Nugevonden-Secret": "abc" } });
    expect(wpSyncSecretOf(withHeader)).toEqual({ secret: "abc", inUrl: false });
    expect(wpSyncSecretOf(new Request("https://x.nl/api/wp-sync/pending?secret=old"))).toEqual({
      secret: "old",
      inUrl: true,
    });
    expect(wpSyncSecretOf(new Request("https://x.nl/api/wp-sync/pending"))).toEqual({ secret: null, inUrl: false });
  });
});
