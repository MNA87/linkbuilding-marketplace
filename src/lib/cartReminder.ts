import { createHash } from "node:crypto";

// The dashboard's cart bar can be closed until the cart changes: the cookie
// holds a fingerprint of what was in it, and a new or removed link gives a
// different one, so the bar comes back.
export const CART_BAR_COOKIE = "cart_bar_hidden";

export function cartFingerprint(customerId: string, itemIds: string[]): string {
  return createHash("sha256")
    .update(`${customerId}:${[...itemIds].sort().join(",")}`)
    .digest("hex")
    .slice(0, 16);
}
