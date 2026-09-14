import { describe, it, expect } from "vitest";
import { validateUpload, UploadValidationError } from "./upload";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("validateUpload", () => {
  it("accepts an allowed file type under the size limit", () => {
    const file = makeFile("test.pdf", "application/pdf", 1024);
    expect(validateUpload(file)).toBe("pdf");
  });

  it("rejects a disallowed file type (whitelist, not a blacklist)", () => {
    const file = makeFile("script.exe", "application/x-msdownload", 1024);
    expect(() => validateUpload(file)).toThrow(UploadValidationError);
  });

  it("rejects an executable disguised with an image MIME type mismatch is still checked by declared type", () => {
    // validateUpload trusts the declared MIME type (not sniffed bytes) —
    // this documents that behavior so a future change to sniff content is
    // a deliberate decision, not an accidental regression.
    const file = makeFile("evil.html", "text/html", 1024);
    expect(() => validateUpload(file)).toThrow(UploadValidationError);
  });

  it("rejects a file over the 10MB limit", () => {
    const file = makeFile("big.pdf", "application/pdf", 10 * 1024 * 1024 + 1);
    expect(() => validateUpload(file)).toThrow(/te groot/);
  });

  it("rejects an empty file", () => {
    const file = makeFile("empty.pdf", "application/pdf", 0);
    expect(() => validateUpload(file)).toThrow(/leeg/);
  });
});
