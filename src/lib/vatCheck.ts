import { prisma } from "@/lib/prisma";
import { isEuCountry } from "@/lib/countries";
import { checkVies, statusFromVies } from "@/lib/vies";
import type { VatStatus } from "@/lib/vatRules";

// Checks a customer's VAT number with VIES and keeps the answer on the
// company: the status that decides "btw verlegd", what the register said and
// the consultation number as proof. Only for a business elsewhere in the EU;
// for anyone else there's nothing to check.
export async function refreshVatCheck(companyId: string): Promise<VatStatus> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return "none";
  if (!company.isBusiness || !company.vatNumber || company.country === "NL" || !isEuCountry(company.country)) {
    await prisma.company.update({
      where: { id: companyId },
      data: { vatStatus: "none", vatCheckedAt: null, vatCheckName: null, vatCheckAddress: null, vatCheckRef: null },
    });
    return "none";
  }
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { sellerVatNumber: true } });
  const answer = await checkVies(company.vatNumber, settings?.sellerVatNumber);
  const status = statusFromVies(answer, company.name);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      vatStatus: status,
      vatCheckedAt: new Date(),
      vatCheckName: answer.ok ? answer.name : null,
      vatCheckAddress: answer.ok ? answer.address : null,
      vatCheckRef: answer.ok ? answer.requestIdentifier : null,
    },
  });
  return status;
}

// VIES didn't answer before: try again, e.g. right before paying. Returns
// whether something changed.
export async function retryUnreachableVatCheck(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { vatStatus: true } });
  if (company?.vatStatus !== "unreachable") return false;
  return (await refreshVatCheck(companyId)) !== "unreachable";
}

// Every hour: all customers whose check is still waiting for VIES.
export async function retryAllUnreachableVatChecks(): Promise<number> {
  const waiting = await prisma.company.findMany({ where: { vatStatus: "unreachable" }, select: { id: true } });
  let done = 0;
  for (const c of waiting) if (await retryUnreachableVatCheck(c.id)) done++;
  return done;
}
