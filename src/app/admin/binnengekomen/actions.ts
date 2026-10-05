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
import { linkMailsToCustomer } from "@/lib/inboundCustomer";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { writingFeeFor } from "@/lib/customerPricing";
import { vatTreatment } from "@/lib/vatRules";
import { MAX_BRIEF_LINKS, type BriefLink } from "@/lib/writingService";
import { readArticle, type FoundLink } from "@/lib/inboundParse";
import { fetchGoogleDocHtml } from "@/lib/googleDoc";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
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

// "Klant aanmaken": a customer from the mail, filled in from the sender and
// checked by you. No password yet (they order by mail); all mails from that
// address or company domain that were "Klant onbekend" join them.
const customerSchema = z.object({
  mailId: z.string().min(1),
  company: z.string().trim().min(2, "Vul de bedrijfsnaam in.").max(200),
  name: z.string().trim().min(1, "Vul een naam in.").max(200),
  email: z.string().trim().toLowerCase().email("Vul een geldig e-mailadres in."),
});

export async function createCustomerFromMailAction(input: unknown): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan." };
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  const { company, name, email } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "Er bestaat al een account met dit e-mailadres." };
  }
  const role = await prisma.role.findUnique({ where: { name: "customer" } });
  if (!role) return { error: "Rol 'customer' bestaat niet." };
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const user = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({ data: { name: company, type: "CUSTOMER" } });
    await tx.project.create({ data: { name: "Bestellingen", customerCompanyId: c.id } });
    return tx.user.create({ data: { email, name, passwordHash, roleId: role.id, companyId: c.id } });
  });
  await linkMailsToCustomer(user.id, email);
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
  if (mail.docUrl && !fromWord) return { error: "Het Google Doc is nog niet ingelezen. Klik op Opnieuw ophalen." };
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
// again, and take the article from it when it works.
export async function refetchDocAction(id: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const mail = await prisma.inboundMail.findUnique({ where: { id: String(id) } });
  if (!mail?.docUrl) return { ok: false, message: "Geen Google Doc bij deze mail." };
  const doc = await fetchGoogleDocHtml(mail.docUrl);
  if (!doc.ok) {
    await prisma.inboundMail.update({ where: { id: mail.id }, data: { docError: doc.error } });
    revalidatePath(`/admin/binnengekomen/${mail.id}`);
    return { ok: false, message: doc.error };
  }
  const domains = (await prisma.website.findMany({ select: { domain: true } })).map((w) => w.domain);
  const article = readArticle(doc.html, domains);
  await prisma.inboundMail.update({
    where: { id: mail.id },
    data: {
      docError: null,
      articleTitle: article.title,
      articleBody: article.body || null,
      ...(article.links.length ? { links: article.links as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  revalidatePath(`/admin/binnengekomen/${mail.id}`);
  return { ok: true, message: "Google Doc ingelezen." };
}
