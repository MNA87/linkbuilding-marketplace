"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fetchInboundMail } from "@/lib/mailbox";
import { isOwnAddress, linkMailsToCustomer, relinkForwardedMails } from "@/lib/inboundCustomer";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { writingFeeFor } from "@/lib/customerPricing";
import { vatTreatment } from "@/lib/vatRules";
import { MAX_BRIEF_LINKS, type BriefLink } from "@/lib/writingService";
import {
  articleLinks,
  findDomain,
  findGoogleDocUrl,
  onlyDomain,
  parseRequests,
  readArticle,
  rewriteArticleLinks,
  type FoundLink,
} from "@/lib/inboundParse";
import { fetchGoogleDocHtml } from "@/lib/googleDoc";
import { sendFromMailbox } from "@/lib/mailbox";
import { emailLayout, emailSenderFrom } from "@/lib/emailLayout";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

// The Google Doc isn't shared: one click sends the customer a short mail,
// in the thread of their own mail, on how to share it.
export async function askToShareDocAction(id: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const mail = await prisma.inboundMail.findUnique({ where: { id: String(id) } });
  if (!mail?.docUrl) return { ok: false, message: "Geen Google Doc bij deze mail." };

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const sender = emailSenderFrom(settings);
  const name = (mail.fromName ?? "").trim().split(/\s+/)[0] ?? "";
  const about = mail.endClient ? ` voor ${mail.endClient}` : "";
  const original = mail.messageId.replace(/#\d+$/, "");
  const subject = `Re: ${mail.subject.replace(/ · aanvraag .*$/, "").replace(/^((re|fw|fwd|antw|doorst)\s*:\s*)+/i, "")}`;
  const steps = [
    "Open het document.",
    "Klik rechtsboven op Delen.",
    "Kies bij Algemene toegang voor Iedereen met de link (Lezer).",
  ];
  const body = `<p>Hoi${name ? ` ${esc(name)}` : ""},</p>
<p>We kunnen het Google Doc${esc(about)} nog niet openen: het is niet gedeeld. Zo zet je het open:</p>
<ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<p>Het gaat om dit document: <a href="${esc(mail.docUrl)}">${esc(mail.docUrl)}</a></p>
<p>Laat even weten als het gelukt is, dan gaan we ermee aan de slag.</p>
<p>Groet,<br>${esc(sender.name || "Nugevonden")}</p>`;
  const text = `Hoi${name ? ` ${name}` : ""},\n\nWe kunnen het Google Doc${about} nog niet openen: het is niet gedeeld. Zo zet je het open:\n\n${steps
    .map((s, i) => `${i + 1}. ${s}`)
    .join(
      "\n"
    )}\n\nHet gaat om dit document: ${mail.docUrl}\n\nLaat even weten als het gelukt is, dan gaan we ermee aan de slag.\n\nGroet,\n${sender.name || "Nugevonden"}`;
  const sent = await sendFromMailbox({
    to: mail.fromEmail,
    subject,
    html: emailLayout({ body, subject, to: mail.fromEmail, sender, appUrl: process.env.NEXTAUTH_URL ?? "" }),
    text,
    fromName: sender.name || "Nugevonden",
    inReplyTo: original,
    references: [original],
  });
  if (!sent.ok) return { ok: false, message: sent.message };
  await prisma.inboundMail.update({ where: { id: mail.id }, data: { shareAskedAt: new Date() } });
  revalidatePath("/admin/binnengekomen", "layout");
  return { ok: true, message: `Verstuurd aan ${mail.fromEmail}.` };
}

// "Nu ophalen": the same as the timer, straight away.
export async function fetchMailNowAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const result = await fetchInboundMail();
  revalidatePath("/admin", "layout");
  return result;
}

// Ignore a mail, or put it back among the new ones.
// A customer's reply is "done" once read; a new order only by making it.
export async function setMailStatusAction(id: string, status: "new" | "ignored" | "done"): Promise<void> {
  if (!(await requireAdmin())) return;
  if (status === "done") {
    await prisma.inboundMail.updateMany({ where: { id: String(id), isReply: true }, data: { status } });
  } else if (status === "new" || status === "ignored") {
    await prisma.inboundMail.updateMany({ where: { id: String(id), status: { not: "done" } }, data: { status } });
  }
  revalidatePath("/admin", "layout");
}

// The links as read from the mail, corrected by you before the order is made.
// With an article, the links in its text change with them (from: the link's
// place in the list as read; a new link isn't in the text yet).
const linksSchema = z
  .array(
    z.object({
      anchor: z.string().trim().max(120, "Een ankertekst is te lang (max. 120 tekens)."),
      url: z
        .string()
        .trim()
        .max(2000)
        .regex(/^https?:\/\/[^\s]+\.[^\s]+$/i, "Vul bij elke link een geldige URL in (met https://)."),
      from: z.number().int().min(0).optional(),
    })
  )
  .max(10, "Maximaal 10 links.");

export async function setMailLinksAction(id: string, input: unknown): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan." };
  const parsed = linksSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  const mail = await prisma.inboundMail.findUnique({
    where: { id: String(id) },
    select: { status: true, links: true, articleBody: true },
  });
  if (!mail || mail.status === "done") return { error: "Deze mail is al verwerkt." };
  let articleBody = mail.articleBody;
  if (articleBody) {
    const domains = (await prisma.website.findMany({ select: { domain: true } })).map((w) => w.domain);
    const before = (Array.isArray(mail.links) ? mail.links : []) as FoundLink[];
    const inText = articleLinks(articleBody, domains);
    // Only when the list still matches the links in the text, link for link.
    if (inText.length > 0 && inText.length === before.length && inText.every((l, i) => l.url === before[i]?.url)) {
      const edits = before.map((_, k) => parsed.data.find((l) => l.from === k) ?? null);
      articleBody = rewriteArticleLinks(articleBody, domains, edits);
    }
  }
  const links: FoundLink[] = parsed.data.map((l) => ({ anchor: l.anchor, url: l.url }));
  const { count } = await prisma.inboundMail.updateMany({
    where: { id: String(id), status: { not: "done" } },
    data: { links: links as unknown as Prisma.InputJsonValue, articleBody },
  });
  if (count === 0) return { error: "Deze mail is al verwerkt." };
  revalidatePath("/admin", "layout");
  return { error: null };
}

// Several mails at once to the archive (test mails, spam) or back to Te doen.
// Mails that became an order (done) stay where they are.
export async function setMailsStatusAction(ids: string[], status: "new" | "ignored"): Promise<void> {
  if (!(await requireAdmin())) return;
  const list = ids.map(String).slice(0, 500);
  await prisma.inboundMail.updateMany({ where: { id: { in: list }, status: { not: "done" } }, data: { status } });
  revalidatePath("/admin", "layout");
}

// "Klant aanmaken": a customer from the mail, filled in from the sender and
// checked by you. No password yet (they order by mail); all mails from that
// address or company domain that were "Klant onbekend" join them.
const customerSchema = z.object({
  mailId: z.string().min(1),
  company: z.string().trim().min(2, "Vul de bedrijfsnaam in.").max(200),
  name: z.string().trim().min(1, "Vul een naam in.").max(200),
  email: z.string().trim().toLowerCase().email("Vul een geldig e-mailadres in."),
  // Where the verzamelfactuur goes, when that's another address (optional).
  invoiceEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Vul bij Facturen naar een geldig e-mailadres in.")
    .or(z.literal(""))
    .optional(),
});

export async function createCustomerFromMailAction(input: unknown): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan." };
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  const { company, name, email } = parsed.data;
  const invoiceEmail = parsed.data.invoiceEmail || null;
  const ownEmails =
    (await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { ownEmails: true } }))?.ownEmails ?? [];
  if (isOwnAddress(email, ownEmails)) {
    return { error: "Dit is je eigen e-mailadres. Vul het adres van de klant in." };
  }
  // Already a customer (e.g. this mail was saved under your own address
  // first): the mail joins them instead.
  const existing = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (existing && existing.role.name !== "customer") {
    return { error: "Er bestaat al een account met dit e-mailadres." };
  }
  const role = await prisma.role.findUnique({ where: { name: "customer" } });
  if (!role) return { error: "Rol 'customer' bestaat niet." };
  const user =
    existing ??
    (await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
      const c = await tx.company.create({ data: { name: company, type: "CUSTOMER", invoiceEmail } });
      await tx.project.create({ data: { name: "Bestellingen", customerCompanyId: c.id } });
      return tx.user.create({ data: { email, name, passwordHash, roleId: role.id, companyId: c.id } });
    }));
  if (existing && invoiceEmail && existing.companyId) {
    await prisma.company.update({ where: { id: existing.companyId }, data: { invoiceEmail } });
  }
  await linkMailsToCustomer(user.id, email);
  await relinkForwardedMails(user.id, email, ownEmails);
  // This mail belongs to them in any case.
  await prisma.inboundMail.updateMany({
    where: { id: parsed.data.mailId, status: { not: "done" } },
    data: { customerId: user.id },
  });
  revalidatePath("/admin", "layout");
  return { error: null };
}

// "Order aanmaken": a blog article on the chosen site, on account (the
// monthly collective invoice), straight into Orders to write and check.
// With a Word file the article is the customer's; with only links it's
// "Laat ons schrijven" with those links as the brief.
const orderSchema = z.object({ mailId: z.string().min(1), websiteId: z.string().min(1, "Kies een website.") });

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export async function createOrderFromMailAction(
  input: unknown
): Promise<{ error: string | null; orderItemId?: string }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan." };
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  const mail = await prisma.inboundMail.findUnique({
    where: { id: parsed.data.mailId },
    include: { customer: { include: { company: { include: { projects: { orderBy: { createdAt: "asc" } } } } } } },
  });
  if (!mail || mail.status === "done") return { error: "Deze mail is al verwerkt." };
  if (!mail.customer?.company) return { error: "Maak eerst de klant aan." };
  const ownEmails =
    (await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { ownEmails: true } }))?.ownEmails ?? [];
  if (isOwnAddress(mail.customer.email, ownEmails)) return { error: "Maak eerst de juiste klant aan." };

  const websiteProduct = await prisma.websiteProduct.findFirst({
    where: { websiteId: parsed.data.websiteId, product: { type: "BLOG_POST" } },
  });
  if (!websiteProduct) return { error: "Deze website heeft geen blogartikel in het aanbod." };

  const links = ((Array.isArray(mail.links) ? mail.links : []) as FoundLink[])
    .filter((l) => /^https?:\/\//i.test(l.url))
    .slice(0, MAX_BRIEF_LINKS);
  const brief: BriefLink[] = links.map((l) => ({ anchor: l.anchor.trim() || hostOf(l.url), url: l.url }));
  const fromWord = Boolean(mail.articleTitle && mail.articleBody);
  // A request with a Google Doc needs the article from it first.
  if ((mail.docUrl ?? (mail.isReply ? null : findGoogleDocUrl(mail.text))) && !fromWord)
    return { error: "Het Google Doc is nog niet ingelezen. Klik op Opnieuw ophalen." };
  if (!fromWord && brief.length === 0) return { error: "Er staan geen links in deze mail." };

  const company = mail.customer.company;
  // A partner's request: their order ID and end client stay with the order.
  const requestNote =
    [mail.externalRef && `Order ID: ${mail.externalRef}`, mail.endClient && `Klant: ${mail.endClient}`]
      .filter(Boolean)
      .join(" · ") || null;
  // The prices agreed with this customer (fixed price, discount, writing
  // included) — see src/lib/customerPricing.ts.
  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id,
    company.id
  );
  const project =
    company.projects[0] ??
    (await prisma.project.create({ data: { name: "Bestellingen", customerCompanyId: company.id } }));

  const order = await prisma.order.create({
    data: {
      customerId: mail.customer.id,
      projectId: project.id,
      status: "PAID",
      onAccount: true,
      // The VAT for this customer, fixed now (21%, or none abroad).
      vatRate: vatTreatment(company).rate,
      vatNote: vatTreatment(company).note,
      items: {
        create: fromWord
          ? {
              websiteProductId: websiteProduct.id,
              periodic: websiteProduct.periodic,
              supplierPriceSnap: supplierPrice,
              customerPriceSnap: customerPrice,
              marginSnap: marginPercent,
              contentSource: "CUSTOMER",
              comments: requestNote,
              articleTitle: mail.articleTitle,
              articleBody: mail.articleBody,
              anchorText: brief[0]?.anchor ?? null,
              targetUrl: brief[0]?.url ?? null,
            }
          : {
              websiteProductId: websiteProduct.id,
              periodic: websiteProduct.periodic,
              supplierPriceSnap: supplierPrice,
              customerPriceSnap: customerPrice,
              marginSnap: marginPercent,
              writeForMe: true,
              comments: requestNote,
              briefLinks: brief as unknown as Prisma.InputJsonValue,
              writingFeeSnap: await writingFeeFor(company.id),
              anchorText: brief[0]?.anchor ?? null,
              targetUrl: brief[0]?.url ?? null,
            },
      },
    },
    include: { items: { select: { id: true } } },
  });
  const orderItemId = order.items[0].id;
  await prisma.inboundMail.update({ where: { id: mail.id }, data: { status: "done", orderItemId } });
  revalidatePath("/admin", "layout");
  return { error: null, orderItemId };
}

// The Google Doc of a request couldn't be read (e.g. not shared yet): try
// again, and take the article from it when it works. A mail taken in before
// loose Google Doc links were read has them in its text: with several, it
// becomes a request each first ("1/2", "2/2"), like a new mail would.
export async function refetchDocAction(id: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const mail = await prisma.inboundMail.findUnique({ where: { id: String(id) } });
  if (!mail) return { ok: false, message: "Geen Google Doc bij deze mail." };
  const websites = await prisma.website.findMany({ select: { id: true, domain: true } });
  const domains = websites.map((w) => w.domain);
  const loose = mail.docUrl || mail.requestLabel || mail.isReply ? [] : parseRequests(mail.text);
  if (!mail.docUrl && loose.length === 0) return { ok: false, message: "Geen Google Doc bij deze mail." };

  const targets: { id: string; docUrl: string }[] = mail.docUrl ? [{ id: mail.id, docUrl: mail.docUrl }] : [];
  for (let i = 0; i < loose.length; i++) {
    const r = loose[i];
    const label = loose.length > 1 ? r.label : null;
    // The site named next to the link, or the only site the mail names.
    const domain =
      (r.partner ? findDomain([r.partner], domains) : null) ?? onlyDomain([mail.subject, mail.text], domains);
    const data = {
      docUrl: r.docUrl,
      requestLabel: label,
      subject: (label ? `${mail.subject} · aanvraag ${label}` : mail.subject).slice(0, 300),
      websiteId: websites.find((w) => w.domain === domain)?.id ?? (label ? null : mail.websiteId),
    };
    if (i === 0) {
      await prisma.inboundMail.update({ where: { id: mail.id }, data });
      targets.push({ id: mail.id, docUrl: r.docUrl! });
    } else {
      const extra = await prisma.inboundMail.create({
        data: {
          ...data,
          messageId: `${mail.messageId}#${i + 1}`,
          fromEmail: mail.fromEmail,
          fromName: mail.fromName,
          forwardedBy: mail.forwardedBy,
          text: mail.text,
          receivedAt: mail.receivedAt,
          customerId: mail.customerId,
          attachments: mail.attachments,
        },
      });
      targets.push({ id: extra.id, docUrl: r.docUrl! });
    }
  }

  let read = 0;
  let error: string | null = null;
  for (const t of targets) {
    const doc = await fetchGoogleDocHtml(t.docUrl);
    if (!doc.ok) {
      error = doc.error;
      await prisma.inboundMail.update({ where: { id: t.id }, data: { docError: doc.error } });
      continue;
    }
    const article = readArticle(doc.html, domains);
    await prisma.inboundMail.update({
      where: { id: t.id },
      data: {
        docError: null,
        articleTitle: article.title,
        articleBody: article.body || null,
        links: article.links as unknown as Prisma.InputJsonValue,
      },
    });
    read++;
  }
  revalidatePath("/admin/binnengekomen", "layout");
  if (targets.length > 1) {
    const split = `In ${targets.length} aanvragen gesplitst`;
    return error
      ? { ok: false, message: `${split}; ${read} van ${targets.length} ingelezen. ${error}` }
      : { ok: true, message: `${split} en ingelezen.` };
  }
  return error ? { ok: false, message: error } : { ok: true, message: "Google Doc ingelezen." };
}
