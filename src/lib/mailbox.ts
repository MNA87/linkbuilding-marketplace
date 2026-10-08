import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import MailComposer from "nodemailer/lib/mail-composer";
import { randomUUID } from "node:crypto";
import { simpleParser, type ParsedMail } from "mailparser";
import mammoth from "mammoth";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { findCustomerForEmail, isOwnAddress } from "@/lib/inboundCustomer";
import {
  findDomain,
  findForwarded,
  linksFromText,
  onlyDomain,
  parseRequests,
  placementLine,
  readArticle,
  type FoundLink,
} from "@/lib/inboundParse";
import { fetchGoogleDocHtml } from "@/lib/googleDoc";
import { sendInboundMailEmail, type NewInboundMail } from "@/lib/email";

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
  // Every Word file is read (each becomes its own request when there are
  // several). A Word file is a zip; anything over 10 MB isn't read, so a
  // crafted attachment can't tie up the server. An old .doc can't be read.
  const articles: { fileName: string; title: string | null; body: string; links: FoundLink[] }[] = [];
  const fileNotes: string[] = [];
  for (const a of attachments) {
    const name = a.filename ?? "bijlage";
    if (/\.doc$/i.test(name) || a.contentType === "application/msword") {
      fileNotes.push(
        `${name} is een oud Word-bestand (.doc) en kan niet worden ingelezen. Sla het op als .docx of vraag de klant om een .docx-bestand.`
      );
      continue;
    }
    if (!isWord(a)) continue;
    if (a.size > 10 * 1024 * 1024) {
      fileNotes.push(`${name} is te groot (meer dan 10 MB) en is niet ingelezen.`);
      continue;
    }
    try {
      const { value } = await mammoth.convertToHtml({ buffer: a.content });
      articles.push({ fileName: name, ...readArticle(value, domains) });
    } catch (err) {
      console.error("Reading Word attachment failed", (err as Error).message);
      fileNotes.push(`${name} kon niet worden ingelezen.`);
    }
  }
  const article = articles[0] ?? null;
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
    articles,
    fileNote: fileNotes.join(" ") || null,
  };
}

let running = false;

// Takes in the unread mails of the last 30 days and marks them read, so each
// is taken in once (the Message-ID guards against doubles too). With `notify`
// (the automatic fetch, not the button in Binnengekomen) the admins get one
// mail listing what came in.
export async function fetchInboundMail({ notify = false } = {}): Promise<{
  ok: boolean;
  message: string;
  added: number;
}> {
  if (running) return { ok: true, message: "Wordt al opgehaald.", added: 0 };
  const login = await getMailboxLogin();
  if (!login) return { ok: false, message: "Er is nog geen mailbox ingesteld.", added: 0 };
  running = true;
  const c = client(login);
  let added = 0;
  const arrived: NewInboundMail[] = [];
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
          const before = added;
          // A reply to a preview we sent (or to the order's first mail)
          // goes with that order.
          const refs = [
            parsed.inReplyTo,
            ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references]),
          ].filter((r): r is string => Boolean(r));
          const repliedTo =
            (refs.length
              ? ((await prisma.outboundMail.findFirst({
                  where: { messageId: { in: refs } },
                  select: { orderItemId: true },
                })) ??
                (await prisma.inboundMail.findFirst({
                  where: { messageId: { in: refs }, orderItemId: { not: null } },
                  select: { orderItemId: true },
                })))
              : null) ?? (await replyBySubject(mail.fromEmail, parsed.subject ?? ""));
          const orderCustomer = repliedTo?.orderItemId
            ? await prisma.orderItem.findUnique({
                where: { id: repliedTo.orderItemId },
                select: { order: { select: { customerId: true } } },
              })
            : null;
          const customer =
            // Never your own address as the customer (a forward whose sender wasn't found).
            (isOwnAddress(mail.fromEmail, ownEmails) ? null : await findCustomerForEmail(mail.fromEmail)) ??
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
          if (requests.length === 0 && mail.articles.length > 1) {
            // Several Word files: one request each, kept as "<id>#1", "<id>#2", …
            const n = mail.articles.length;
            for (let i = 0; i < n; i++) {
              const a = mail.articles[i];
              await prisma.inboundMail.create({
                data: {
                  ...base,
                  messageId: `${messageId}#${i + 1}`,
                  subject: `${mail.subject} · bestand ${i + 1}/${n}`.slice(0, 300),
                  // The site named in the file, or else the only one the mail names.
                  websiteId: siteId(
                    findDomain([a.fileName, a.title ?? ""], domains) ?? onlyDomain([mail.subject, mail.text], domains)
                  ),
                  articleTitle: a.title,
                  articleBody: a.body || null,
                  links: a.links,
                  requestLabel: `${i + 1}/${n}`,
                  fileName: a.fileName,
                  fileNote: mail.fileNote,
                },
              });
              added++;
            }
          } else if (requests.length === 0) {
            await prisma.inboundMail.create({
              data: {
                ...base,
                messageId,
                subject: mail.subject,
                websiteId: siteId(mail.domain),
                articleTitle: mail.articleTitle,
                articleBody: mail.articleBody,
                links: mail.links,
                fileName: mail.articles.length === 1 ? mail.articles[0].fileName : null,
                fileNote: mail.fileNote,
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
                // The site named with the request, or else the one the mail is about.
                websiteId: siteId(
                  (r.partner ? findDomain([r.partner], domains) : null) ??
                    (single ? mail.domain : onlyDomain([mail.subject, mail.text], domains))
                ),
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
          if (added > before) {
            arrived.push({
              from: mail.fromName || mail.fromEmail,
              subject: mail.subject,
              requests: added - before,
              isReply: Boolean(repliedTo?.orderItemId),
            });
          }
        }
        await c.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
    if (notify && arrived.length) await notifyAdmins(arrived);
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

// To the admins, once per fetch: what just came into Binnengekomen.
async function notifyAdmins(arrived: NewInboundMail[]) {
  const admins = await prisma.user.findMany({ where: { role: { name: "admin" } }, select: { email: true } });
  for (const { email } of admins) await sendInboundMailEmail(email, arrived).catch(() => undefined);
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

// A mail from the order mailbox (a Word preview, "vraag om te delen"), in
// the thread of the customer's own mail so they can just answer. It goes out
// through Resend (the host blocks outgoing SMTP), with the mailbox as the
// address to answer to; without Resend, through the mailbox's own SMTP
// (SiteGround, port 465). Either way a copy goes into the mailbox's Sent
// folder, so the whole conversation is together there. Returns the
// Message-ID, to match the answer to the order.
const addressOf = (from: string) => (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
const domainOf = (email: string) => email.split("@")[1] ?? "";
const bracket = (id: string) => (id.startsWith("<") ? id : `<${id}>`);

// An answer whose mail program dropped the thread references: "Re: <the
// subject of a preview we sent to that address>" still finds the order.
const bareSubject = (s: string) =>
  s
    .replace(/^((re|fw|fwd|antw|doorst|aw|wg)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();

async function replyBySubject(fromEmail: string, subject: string): Promise<{ orderItemId: string } | null> {
  if (!fromEmail || !/^\s*(re|antw|aw)\s*:/i.test(subject)) return null;
  const sent = await prisma.outboundMail.findMany({
    where: { toEmail: { equals: fromEmail, mode: "insensitive" } },
    orderBy: { sentAt: "desc" },
    take: 50,
    select: { orderItemId: true, subject: true },
  });
  return sent.find((m) => bareSubject(m.subject) === bareSubject(subject)) ?? null;
}

export async function sendFromMailbox(
  mail: OutgoingMail
): Promise<{ ok: true; messageId: string } | { ok: false; message: string }> {
  const login = await getMailboxLogin();
  if (!login) return { ok: false, message: "Koppel eerst de mailbox bij Instellingen → Koppelingen." };
  const name = mail.fromName || undefined;
  let messageId = `<${randomUUID()}@${domainOf(login.user) || "localhost"}>`;
  let from = login.user;

  if (process.env.RESEND_API_KEY) {
    // Resend only sends from its verified domain: the mailbox address itself
    // when it's on that domain, else the platform's address.
    const platform = addressOf(process.env.EMAIL_FROM ?? "no-reply@nugevonden.nl");
    from = domainOf(login.user.toLowerCase()) === domainOf(platform) ? login.user : platform;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const headers: Record<string, string> = { "Message-ID": messageId };
    if (mail.inReplyTo) headers["In-Reply-To"] = mail.inReplyTo;
    if (mail.references?.length) headers["References"] = mail.references.join(" ");
    const { data, error } = await resend.emails.send({
      from: name ? `${name.replace(/["<>]/g, "")} <${from}>` : from,
      to: mail.to,
      replyTo: login.user,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error || !data) {
      console.error("Sending through Resend failed", error);
      return { ok: false, message: "Versturen mislukt. Probeer het zo nog eens." };
    }
    // The Message-ID the customer's answer will refer to.
    const sent = await resend.emails.get(data.id).catch(() => null);
    if (sent?.data?.message_id) messageId = bracket(sent.data.message_id);
  }

  const raw = await new MailComposer({
    from: name ? { name, address: from } : from,
    replyTo: from === login.user ? undefined : login.user,
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

  if (!process.env.RESEND_API_KEY) {
    try {
      const transport = nodemailer.createTransport({
        host: login.host,
        port: 465,
        secure: true,
        auth: { user: login.user, pass: login.password },
        // Fail within seconds instead of the default two minutes.
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
      });
      await transport.sendMail({ envelope: { from: login.user, to: [mail.to] }, raw });
    } catch (err) {
      console.error("Sending from the mailbox failed", (err as Error).message);
      return { ok: false, message: explain(err).replace("poort 993", "poort 465") };
    }
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
