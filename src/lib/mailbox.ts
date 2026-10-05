import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { randomUUID } from "node:crypto";
import { simpleParser, type ParsedMail } from "mailparser";
import mammoth from "mammoth";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { findCustomerForEmail } from "@/lib/inboundCustomer";
import {
  findDomain,
  findForwarded,
  linksFromText,
  parseRequests,
  placementLine,
  readArticle,
  type FoundLink,
} from "@/lib/inboundParse";
import { fetchGoogleDocHtml } from "@/lib/googleDoc";

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
  return {
    configured: Boolean(login),
    user: login?.user ?? null,
    host: login?.host ?? null,
    unreadable: Boolean(row && !login),
  };
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
// forward to the order mailbox (from one of your own addresses, Instellingen
// → Koppelingen) is read as the customer's: the original sender comes from
// the forwarded mail, attached or quoted in the text. Mails from anyone else
// are the customer's own. With no own addresses set, any forward counts.
export async function readMail(outer: ParsedMail, domains: string[], ownEmails: string[] = []) {
  const outerFrom = outer.from?.value[0];
  const outerEmail = (outerFrom?.address ?? "").toLowerCase();
  const own = ownEmails.map((e) => e.toLowerCase());
  const fromMe = own.length === 0 || own.includes(outerEmail);
  const attachedMail = fromMe ? outer.attachments.find((a) => a.contentType === "message/rfc822") : undefined;
  const parsed = attachedMail ? await simpleParser(attachedMail.content) : outer;
  const from = parsed.from?.value[0];
  const text = (outer.text ?? "").slice(0, 20_000);
  const allText = attachedMail ? `${text}\n\n${(parsed.text ?? "").slice(0, 20_000)}` : text;
  const quoted = attachedMail || !fromMe ? null : findForwarded(text, own);
  const attachments = [
    ...outer.attachments.filter((a) => a !== attachedMail),
    ...(attachedMail ? parsed.attachments : []),
  ];
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
  // "Website plaatsing: …" in the mail wins; then the subject, the text, the Word file.
  const domain = findDomain(
    [placementLine(allText) ?? "", subject, outer.subject ?? "", allText, article?.title ?? "", ...names],
    domains
  );
  // From you but no customer found in it: still marked, so it's clear why.
  const forwarded = Boolean(attachedMail || quoted || (own.length > 0 && fromMe));
  return {
    fromEmail: (quoted?.fromEmail ?? from?.address ?? "").toLowerCase(),
    fromName: (quoted ? quoted.fromName : from?.name) || null,
    forwardedBy: forwarded ? outerEmail || null : null,
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
      const ownEmails =
        (await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { ownEmails: true } }))?.ownEmails ?? [];
      const domains = websites.map((w) => w.domain);
      for (const { uid, source } of sources) {
        const parsed = await simpleParser(source);
        const messageId = parsed.messageId ?? `sha256:${createHash("sha256").update(source).digest("hex")}`;
        // One mail with several requests is kept as "<id>#1", "<id>#2", …
        const exists = await prisma.inboundMail.findFirst({
          where: { messageId: { in: [messageId, `${messageId}#1`] } },
          select: { id: true },
        });
        if (!exists) {
          const mail = await readMail(parsed, domains, ownEmails);
          // A reply to a preview we sent (or to the order's first mail)
          // goes with that order.
          const refs = [
            parsed.inReplyTo,
            ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references]),
          ].filter((r): r is string => Boolean(r));
          const repliedTo = refs.length
            ? ((await prisma.outboundMail.findFirst({
                where: { messageId: { in: refs } },
                select: { orderItemId: true },
              })) ??
              (await prisma.inboundMail.findFirst({
                where: { messageId: { in: refs }, orderItemId: { not: null } },
                select: { orderItemId: true },
              })))
            : null;
          const orderCustomer = repliedTo?.orderItemId
            ? await prisma.orderItem.findUnique({
                where: { id: repliedTo.orderItemId },
                select: { order: { select: { customerId: true } } },
              })
            : null;
          const customer =
            (await findCustomerForEmail(mail.fromEmail)) ??
            (orderCustomer ? { id: orderCustomer.order.customerId } : null);
          const base = {
            fromEmail: mail.fromEmail,
            fromName: mail.fromName,
            forwardedBy: mail.forwardedBy,
            text: mail.text,
            receivedAt: parsed.date ?? new Date(),
            customerId: customer?.id ?? null,
            attachments: mail.attachments,
            orderItemId: repliedTo?.orderItemId ?? null,
            isReply: Boolean(repliedTo?.orderItemId),
            inReplyTo: parsed.inReplyTo ?? null,
          };
          const siteId = (domain: string | null) => websites.find((w) => w.domain === domain)?.id ?? null;
          // A partner's mail with "Aanvraag 1/2 … Docs URL …": one request
          // each, with the article read from its Google Doc.
          const requests = repliedTo?.orderItemId ? [] : parseRequests(mail.text);
          if (requests.length === 0) {
            await prisma.inboundMail.create({
              data: {
                ...base,
                messageId,
                subject: mail.subject,
                websiteId: siteId(mail.domain),
                articleTitle: mail.articleTitle,
                articleBody: mail.articleBody,
                links: mail.links,
              },
            });
            added++;
          }
          for (let i = 0; i < requests.length; i++) {
            const r = requests[i];
            const doc = r.docUrl ? await fetchGoogleDocHtml(r.docUrl) : null;
            const article = doc?.ok ? readArticle(doc.html, domains) : null;
            const single = requests.length === 1;
            await prisma.inboundMail.create({
              data: {
                ...base,
                messageId: single ? messageId : `${messageId}#${i + 1}`,
                subject: (r.label ? `${mail.subject} · aanvraag ${r.label}` : mail.subject).slice(0, 300),
                websiteId: siteId(r.partner ? findDomain([r.partner], domains) : single ? mail.domain : null),
                articleTitle: article?.title ?? (single ? mail.articleTitle : null),
                articleBody: article?.body || (single ? mail.articleBody : null),
                links: article?.links.length ? article.links : single ? mail.links : [],
                requestLabel: r.label,
                docUrl: r.docUrl,
                docError: doc && !doc.ok ? doc.error : null,
                endClient: r.client,
                externalRef: r.ref,
                quotedPrice: r.price,
              },
            });
            added++;
          }
        }
        await c.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
    return {
      ok: true,
      message: added === 1 ? "1 nieuwe mail binnengehaald." : `${added} nieuwe mails binnengehaald.`,
      added,
    };
  } catch (err) {
    console.error("Fetching inbound mail failed", (err as Error).message);
    return { ok: false, message: explain(err), added };
  } finally {
    running = false;
    await c.logout().catch(() => undefined);
  }
}

export type OutgoingMail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  // The thread it answers, so it shows as a reply in the customer's mail.
  inReplyTo?: string | null;
  references?: string[];
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

// Sends from the order mailbox itself (SMTP on the same SiteGround server,
// port 465), so the customer sees it from seo@… in the same thread and can
// just answer. A copy goes into the mailbox's Sent folder. Returns the
// Message-ID, to match the answer to the order.
export async function sendFromMailbox(
  mail: OutgoingMail
): Promise<{ ok: true; messageId: string } | { ok: false; message: string }> {
  const login = await getMailboxLogin();
  if (!login) return { ok: false, message: "Koppel eerst de mailbox bij Instellingen → Koppelingen." };
  const domain = login.user.split("@")[1] ?? "localhost";
  const messageId = `<${randomUUID()}@${domain}>`;
  const raw = await new MailComposer({
    from: mail.fromName ? { name: mail.fromName, address: login.user } : login.user,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    messageId,
    inReplyTo: mail.inReplyTo ?? undefined,
    references: mail.references?.length ? mail.references : undefined,
    attachments: mail.attachments,
  })
    .compile()
    .build();
  try {
    const transport = nodemailer.createTransport({
      host: login.host,
      port: 465,
      secure: true,
      auth: { user: login.user, pass: login.password },
    });
    await transport.sendMail({ envelope: { from: login.user, to: [mail.to] }, raw });
  } catch (err) {
    console.error("Sending from the mailbox failed", (err as Error).message);
    return { ok: false, message: explain(err).replace("poort 993", "poort 465") };
  }
  // The copy in Sent is a nicety: a failure there doesn't undo the send.
  const c = client(login);
  try {
    await c.connect();
    const boxes = await c.list();
    const sent =
      boxes.find((b) => b.specialUse === "\\Sent") ?? boxes.find((b) => /(^|[./])(sent|verzonden)/i.test(b.path));
    if (sent) await c.append(sent.path, raw, ["\\Seen"]);
  } catch (err) {
    console.error("Saving to Sent failed", (err as Error).message);
  } finally {
    await c.logout().catch(() => undefined);
  }
  return { ok: true, messageId };
}
