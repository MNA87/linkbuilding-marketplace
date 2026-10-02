import { prisma } from "@/lib/prisma";

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
