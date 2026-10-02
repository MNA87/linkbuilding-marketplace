import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import mammoth from "mammoth";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { findDomain, findForwarded, linksFromText, readArticle, type FoundLink } from "@/lib/inboundParse";

// The order mailbox (e.g. seo@mnamediainvest.nl at SiteGround): the platform
// logs in over IMAP every few minutes and takes in the new mails, which then
// show under Admin → Binnengekomen. The login is set in Instellingen →
// Koppelingen and kept encrypted, like the API keys.

export type MailboxLogin = { host: string; user: string; password: string };

const ROW = "mailbox";

export async function getMailboxLogin(): Promise<MailboxLogin | null> {
  const row = await prisma.apiCredential.findUnique({ where: { provider: ROW } });
  const plain = row ? decryptSecret(row.ciphertext) : null;
  if (!plain) return null;
  try {
    return JSON.parse(plain) as MailboxLogin;
  } catch {
    return null;
  }
}

export type MailboxStatus = { configured: boolean; user: string | null; host: string | null; unreadable: boolean };

export async function mailboxStatus(): Promise<MailboxStatus> {
  const row = await prisma.apiCredential.findUnique({ where: { provider: ROW } });
  const login = row ? await getMailboxLogin() : null;
  return { configured: Boolean(login), user: login?.user ?? null, host: login?.host ?? null, unreadable: Boolean(row && !login) };
}

export async function saveMailboxLogin(login: MailboxLogin): Promise<void> {
  // last4 holds the address here, so the settings can show which mailbox.
  const data = { ciphertext: encryptSecret(JSON.stringify(login)), last4: login.user };
  await prisma.apiCredential.upsert({ where: { provider: ROW }, create: { provider: ROW, ...data }, update: data });
}

export async function deleteMailboxLogin(): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { provider: ROW } });
}

function client(login: MailboxLogin) {
  return new ImapFlow({
    host: login.host,
    port: 993,
    secure: true,
    auth: { user: login.user, pass: login.password },
    logger: false,
    socketTimeout: 60_000,
  });
}

// Plain words for what went wrong; the details stay in the server log.
function explain(err: unknown): string {
  const e = err as { authenticationFailed?: boolean; code?: string; message?: string };
  if (e.authenticationFailed) return "Inloggen geweigerd: controleer het e-mailadres en wachtwoord.";
  if (e.code === "ENOTFOUND") return "Deze server bestaat niet: controleer de servernaam.";
  if (e.code === "ERR_TLS_CERT_ALTNAME_INVALID" || /certificate/i.test(e.message ?? ""))
    return "Het beveiligingscertificaat past niet bij deze servernaam. Gebruik de servernaam uit SiteGround (eindigt op siteground.biz).";
  if (e.code === "ETIMEDOUT" || e.code === "ECONNREFUSED") return "Geen verbinding met de server (poort 993).";
  return "Verbinden mislukt. Probeer het zo nog eens.";
}

export async function testMailbox(login?: MailboxLogin | null): Promise<{ ok: boolean; message: string }> {
  const l = login ?? (await getMailboxLogin());
  if (!l) return { ok: false, message: "Er is nog geen mailbox ingesteld." };
  const c = client(l);
  try {
    await c.connect();
    const status = await c.status("INBOX", { messages: true, unseen: true });
    const unseen = status ? (status.unseen ?? 0) : 0;
    return { ok: true, message: `Verbinding werkt · ${unseen} ongelezen in de inbox` };
  } catch (err) {
    console.error("Mailbox test failed", (err as Error).message);
    return { ok: false, message: explain(err) };
  } finally {
    await c.logout().catch(() => undefined);
  }
}

const isWord = (a: { filename?: string; contentType: string }) =>
  /\.docx$/i.test(a.filename ?? "") ||
  a.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// What the platform reads from one mail, before it's saved. A mail you
// forward to the order mailbox is read as the customer's: the original
// sender comes from the forwarded mail (attached, or quoted in the text).
export async function readMail(outer: ParsedMail, domains: string[]) {
  const outerFrom = outer.from?.value[0];
  const attachedMail = outer.attachments.find((a) => a.contentType === "message/rfc822");
  const parsed = attachedMail ? await simpleParser(attachedMail.content) : outer;
  const from = parsed.from?.value[0];
  const text = (outer.text ?? "").slice(0, 20_000);
  const allText = attachedMail ? `${text}\n\n${(parsed.text ?? "").slice(0, 20_000)}` : text;
  const quoted = attachedMail ? null : findForwarded(text);
  const attachments = [...outer.attachments.filter((a) => a !== attachedMail), ...(attachedMail ? parsed.attachments : [])];
  const names = attachments.map((a) => a.filename ?? "bijlage");
  let article: { title: string | null; body: string; links: FoundLink[] } | null = null;
  // A Word file is a zip; anything over 10 MB isn't read, so a crafted
  // attachment can't tie up the server.
  const word = attachments.find((a) => isWord(a) && a.size <= 10 * 1024 * 1024);
  if (word) {
    try {
      const { value } = await mammoth.convertToHtml({ buffer: word.content });
      article = readArticle(value, domains);
    } catch (err) {
      console.error("Reading Word attachment failed", (err as Error).message);
    }
  }
  const links = article?.links.length ? article.links : linksFromText(allText, domains);
  const subject = quoted?.subject ?? parsed.subject ?? outer.subject ?? "(geen onderwerp)";
  const domain = findDomain([subject, outer.subject ?? "", allText, article?.title ?? "", ...names], domains);
  const forwarded = Boolean(attachedMail || quoted);
  return {
    fromEmail: (quoted?.fromEmail ?? from?.address ?? "").toLowerCase(),
    fromName: (quoted ? quoted.fromName : from?.name) || null,
    forwardedBy: forwarded ? (outerFrom?.address ?? "").toLowerCase() || null : null,
    subject: subject.slice(0, 300),
    text: allText.slice(0, 40_000),
    articleTitle: article?.title ?? null,
    articleBody: article?.body || null,
    links,
    attachments: names,
    domain,
  };
}

let running = false;

// Takes in the unread mails of the last 30 days and marks them read, so each
// is taken in once (the Message-ID guards against doubles too).
export async function fetchInboundMail(): Promise<{ ok: boolean; message: string; added: number }> {
  if (running) return { ok: true, message: "Wordt al opgehaald.", added: 0 };
  const login = await getMailboxLogin();
  if (!login) return { ok: false, message: "Er is nog geen mailbox ingesteld.", added: 0 };
  running = true;
  const c = client(login);
  let added = 0;
  try {
    await c.connect();
    const lock = await c.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const uids = (await c.search({ seen: false, since }, { uid: true })) || [];
      if (uids.length === 0) return { ok: true, message: "Geen nieuwe mail.", added: 0 };
      const sources: { uid: number; source: Buffer }[] = [];
      for await (const msg of c.fetch(uids.slice(0, 50), { uid: true, source: true }, { uid: true })) {
        if (msg.source) sources.push({ uid: msg.uid, source: msg.source });
      }
      const websites = await prisma.website.findMany({ select: { id: true, domain: true } });
      const domains = websites.map((w) => w.domain);
      for (const { uid, source } of sources) {
        const parsed = await simpleParser(source);
        const messageId = parsed.messageId ?? `sha256:${createHash("sha256").update(source).digest("hex")}`;
        const exists = await prisma.inboundMail.findUnique({ where: { messageId }, select: { id: true } });
        if (!exists) {
          const mail = await readMail(parsed, domains);
          const customer = mail.fromEmail
            ? await prisma.user.findFirst({
                where: { email: { equals: mail.fromEmail, mode: "insensitive" }, role: { name: "customer" } },
                select: { id: true },
              })
            : null;
          await prisma.inboundMail.create({
            data: {
              messageId,
              fromEmail: mail.fromEmail,
              fromName: mail.fromName,
              forwardedBy: mail.forwardedBy,
              subject: mail.subject,
              text: mail.text,
              receivedAt: parsed.date ?? new Date(),
              customerId: customer?.id ?? null,
              websiteId: websites.find((w) => w.domain === mail.domain)?.id ?? null,
              articleTitle: mail.articleTitle,
              articleBody: mail.articleBody,
              links: mail.links,
              attachments: mail.attachments,
            },
          });
          added++;
        }
        await c.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
    return { ok: true, message: added === 1 ? "1 nieuwe mail binnengehaald." : `${added} nieuwe mails binnengehaald.`, added };
  } catch (err) {
    console.error("Fetching inbound mail failed", (err as Error).message);
    return { ok: false, message: explain(err), added };
  } finally {
    running = false;
    await c.logout().catch(() => undefined);
  }
}
