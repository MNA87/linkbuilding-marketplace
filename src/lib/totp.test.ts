import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hashBackupCode,
  newBackupCodes,
  newTotpSecret,
  totpCode,
  totpUri,
  spendBackupCode,
  verifyTotp,
} from "./totp";

// RFC 6238 test secret "12345678901234567890" (SHA1), as base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from("hallo wereld!");
    expect(base32Decode(base32Encode(buf)).toString()).toBe("hallo wereld!");
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
  it("matches the RFC 6238 test values", () => {
    expect(totpCode(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totpCode(RFC_SECRET, 1111111109_000, 8)).toBe("07081804");
    expect(totpCode(RFC_SECRET, 1234567890_000, 8)).toBe("89005924");
    expect(totpCode(RFC_SECRET, 20000000000_000, 8)).toBe("65353130");
  });
  it("accepts the code of now and a step either side, nothing else", () => {
    const secret = newTotpSecret();
    const now = 1_760_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
  });
  it("makes a URI the apps read", () => {
    expect(totpUri("ABC", "admin@x.nl", "Nugevonden")).toBe(
      "otpauth://totp/Nugevonden%3Aadmin%40x.nl?secret=ABC&issuer=Nugevonden&algorithm=SHA1&digits=6&period=30"
    );
  });
  it("lets each reservecode in once", () => {
    const codes = newBackupCodes();
    expect(codes).toHaveLength(8);
    expect(codes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const hashes = codes.map(hashBackupCode);
    const left = spendBackupCode(hashes, codes[2].toLowerCase().replace("-", " "));
    expect(left).toHaveLength(7);
    expect(spendBackupCode(left!, codes[2])).toBeNull();
  });
});
