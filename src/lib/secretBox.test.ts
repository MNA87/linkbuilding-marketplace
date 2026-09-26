import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secretBox";

describe("secretBox", () => {
  const secret = "test-secret";

  it("reads back what it stored, without the plain text showing", () => {
    const box = encryptSecret("my-api-key-123", secret);
    expect(box).not.toContain("my-api-key");
    expect(decryptSecret(box, secret)).toBe("my-api-key-123");
  });

  it("gives a different box each time", () => {
    expect(encryptSecret("same", secret)).not.toBe(encryptSecret("same", secret));
  });

  it("can't be read with another secret or when tampered with", () => {
    const box = encryptSecret("my-api-key-123", secret);
    expect(decryptSecret(box, "other-secret")).toBeNull();
    const [iv, tag, data] = box.split(".");
    expect(decryptSecret([iv, tag, Buffer.from("x" + data).toString("base64")].join("."), secret)).toBeNull();
    expect(decryptSecret("rubbish", secret)).toBeNull();
  });
});
