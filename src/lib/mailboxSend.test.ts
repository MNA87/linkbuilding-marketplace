import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendFromMailbox } from "./mailbox";

const sent: Record<string, unknown>[] = [];
const appended: { path: string; raw: string }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: { apiCredential: { findUnique: async () => ({ ciphertext: "x" }) } },
}));
vi.mock("@/lib/secretBox", () => ({
  decryptSecret: () => JSON.stringify({ host: "mail.example.com", user: "seo@nugevonden.nl", password: "pw" }),
  encryptSecret: (s: string) => s,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { data: { id: "re_1" }, error: null };
      },
      get: async () => ({ data: { message_id: "abc@eu-west-1.amazonses.com" } }),
    };
  },
}));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    async connect() {}
    async list() {
      return [{ path: "INBOX.Sent", specialUse: "\\Sent" }];
    }
    async append(path: string, raw: Buffer) {
      appended.push({ path, raw: raw.toString() });
    }
    async logout() {}
  },
}));


describe("sendFromMailbox through Resend", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Nugevonden <no-reply@nugevonden.nl>");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    sent.length = 0;
    appended.length = 0;
  });

  it("sends in the customer's thread, answers to the mailbox, and keeps a copy in Sent", async () => {
    const r = await sendFromMailbox({
      to: "tim@allthewayup.nl",
      subject: "Re: Artikel mos",
      html: "<p>Hoi</p>",
      text: "Hoi",
      fromName: "Nugevonden",
      inReplyTo: "<orig@allthewayup.nl>",
      references: ["<orig@allthewayup.nl>"],
      attachments: [{ filename: "Preview.docx", content: Buffer.from("x"), contentType: "application/octet-stream" }],
    });
    expect(r).toEqual({ ok: true, messageId: "<abc@eu-west-1.amazonses.com>" });
    expect(sent[0]).toMatchObject({
      from: "Nugevonden <seo@nugevonden.nl>",
      to: "tim@allthewayup.nl",
      replyTo: "seo@nugevonden.nl",
      headers: { "In-Reply-To": "<orig@allthewayup.nl>", References: "<orig@allthewayup.nl>" },
    });
    expect(appended[0].path).toBe("INBOX.Sent");
    expect(appended[0].raw).toContain("Message-ID: <abc@eu-west-1.amazonses.com>");
    expect(appended[0].raw).toContain("In-Reply-To: <orig@allthewayup.nl>");
  });

  it("sends from the platform's address when the mailbox is on another domain", async () => {
    vi.stubEnv("EMAIL_FROM", "Nugevonden <no-reply@mijn.nugevonden.nl>");
    await sendFromMailbox({ to: "a@b.nl", subject: "Hoi", html: "<p>x</p>", text: "x" });
    expect(sent[0]).toMatchObject({ from: "no-reply@mijn.nugevonden.nl", replyTo: "seo@nugevonden.nl" });
    expect(appended[0].raw).toContain("Reply-To: seo@nugevonden.nl");
  });
});
