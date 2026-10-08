import { prisma } from "@/lib/prisma";
import { findForwarded } from "@/lib/inboundParse";

// Who a mail on Binnengekomen is from: a customer by their exact address,
// or by the domain of their company (tim@ and sanne@allthewayup.nl are both
// All the way up). Free mail domains don't count as a company.
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.nl",
  "outlook.com",
  "outlook.nl",
  "live.com",
  "live.nl",
  "msn.com",
  "yahoo.com",
  "yahoo.nl",
  "icloud.com",
  "me.com",
  "mac.com",
  "ziggo.nl",
  "kpnmail.nl",
  "kpnplanet.nl",
  "planet.nl",
  "home.nl",
  "hetnet.nl",
  "xs4all.nl",
  "telfort.nl",
  "online.nl",
  "chello.nl",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : null;
}

// A company domain (not gmail.com and the like), or null.
export function companyDomain(email: string): string | null {
  const domain = emailDomain(email);
  return domain && !FREE_MAIL.has(domain) ? domain : null;
}

// A suggestion for the company name from the address: allthewayup.nl → Allthewayup.
export function companyNameFromEmail(email: string): string {
  const domain = companyDomain(email);
  if (!domain) return "";
  const name = domain.split(".")[0] ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// One of your own addresses (Instellingen → Koppelingen), or another address
// at the company domain of one: info@ and tim@mnamediainvest.nl are both you.
export function isOwnAddress(email: string, ownEmails: string[]): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const own = ownEmails.map((o) => o.trim().toLowerCase());
  if (own.includes(e)) return true;
  const domain = companyDomain(e);
  return domain !== null && own.some((o) => companyDomain(o) === domain);
}

export async function findCustomerForEmail(email: string): Promise<{ id: string } | null> {
  if (!email) return null;
  const where = { role: { name: "customer" }, status: "active" };
  const exact = await prisma.user.findFirst({
    where: { ...where, email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact;
  const domain = companyDomain(email);
  if (!domain) return null;
  return prisma.user.findFirst({
    where: { ...where, email: { endsWith: `@${domain}`, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

// After a customer is added: the mails from that address (or that company's
// domain) that were still "Klant onbekend" now belong to them.
export async function linkMailsToCustomer(customerId: string, email: string): Promise<number> {
  const domain = companyDomain(email);
  const { count } = await prisma.inboundMail.updateMany({
    where: {
      customerId: null,
      OR: [
        { fromEmail: { equals: email, mode: "insensitive" } },
        ...(domain ? [{ fromEmail: { endsWith: `@${domain}`, mode: "insensitive" as const } }] : []),
      ],
    },
    data: { customerId },
  });
  return count;
}

// Mails you forwarded that were saved under your own address (before the
// sender was read from them) are read again: the ones from this customer's
// address or company domain get the customer's sender and join them.
export async function relinkForwardedMails(customerId: string, email: string, ownEmails: string[]): Promise<number> {
  if (ownEmails.length === 0) return 0;
  const domain = companyDomain(email);
  const mails = await prisma.inboundMail.findMany({
    where: {
      fromEmail: { in: ownEmails.map((o) => o.toLowerCase()) },
      // Not linked yet, or linked to a customer made from your own address.
      OR: [{ customerId: null }, { customer: { email: { in: ownEmails.map((o) => o.toLowerCase()) } } }],
      status: { not: "done" },
    },
    select: { id: true, text: true },
    take: 500,
  });
  let count = 0;
  for (const mail of mails) {
    const sender = findForwarded(mail.text, ownEmails);
    if (!sender) continue;
    if (sender.fromEmail !== email && !(domain && emailDomain(sender.fromEmail) === domain)) continue;
    await prisma.inboundMail.update({
      where: { id: mail.id },
      data: { customerId, fromEmail: sender.fromEmail, fromName: sender.fromName },
    });
    count++;
  }
  return count;
}
