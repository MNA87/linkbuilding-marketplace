import { describe, expect, it } from "vitest";
import {
  afterFailedLogin,
  describeDevice,
  deviceToken,
  isLocked,
  isRememberedDevice,
  notMeToken,
  readNotMeToken,
} from "./loginSecurity";

describe("loginSecurity", () => {
  it("locks for 30 minutes at the 10th wrong try", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(afterFailedLogin(3, now)).toEqual({ failedLogins: 4, lockedUntil: null });
    const locked = afterFailedLogin(9, now);
    expect(locked.failedLogins).toBe(0);
    expect(locked.lockedUntil?.toISOString()).toBe("2026-10-07T10:30:00.000Z");
    expect(isLocked(locked.lockedUntil, new Date("2026-10-07T10:29:00Z"))).toBe(true);
    expect(isLocked(locked.lockedUntil, new Date("2026-10-07T10:31:00Z"))).toBe(false);
    expect(isLocked(null)).toBe(false);
  });
  it("names the device", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
      )
    ).toBe("Chrome op Mac");
    expect(
      describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1")
    ).toBe("Safari op iPhone/iPad");
    expect(describeDevice(undefined)).toBe("Onbekend apparaat");
  });
  it("signs the Dit was ik niet link, valid for a week", () => {
    const now = 1_760_000_000_000;
    const token = notMeToken("user1", now, "s3cret");
    expect(readNotMeToken(token, now + 86_400_000, "s3cret")).toBe("user1");
    expect(readNotMeToken(token, now + 8 * 86_400_000, "s3cret")).toBeNull();
    expect(readNotMeToken(token, now, "other")).toBeNull();
    expect(
      readNotMeToken(
        token.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
        now,
        "s3cret"
      )
    ).toBeNull();
    expect(readNotMeToken("rommel", now, "s3cret")).toBeNull();
  });
  it("remembers a device for 30 days, until the password or 2FA changes", () => {
    const now = 1_760_000_000_000;
    const token = deviceToken("user1", "1.123", now, "s3cret");
    expect(isRememberedDevice(token, "user1", "1.123", now + 29 * 86_400_000, "s3cret")).toBe(true);
    expect(isRememberedDevice(token, "user1", "1.123", now + 31 * 86_400_000, "s3cret")).toBe(false);
    expect(isRememberedDevice(token, "user2", "1.123", now, "s3cret")).toBe(false);
    expect(isRememberedDevice(token, "user1", "2.123", now, "s3cret")).toBe(false);
    expect(isRememberedDevice(token, "user1", "1.456", now, "s3cret")).toBe(false);
    expect(isRememberedDevice(token, "user1", "1.123", now, "other")).toBe(false);
    expect(isRememberedDevice(undefined, "user1", "1.123", now, "s3cret")).toBe(false);
  });
});
