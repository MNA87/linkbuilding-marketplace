import type { Company, User } from "@prisma/client";
import type { DetailsValues } from "./MyDetailsForm";

// What "Mijn gegevens" starts from — on Account, in the cart while the
// invoice details are still missing, and on the customer's page for the
// admin. Business customers only: the address is the company's (the one on
// the invoices); customers from before then may only have their own.
export function detailsOf(user: User, company: Company): DetailsValues {
  const billing = Boolean(company.billingAddress);
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    companyName: company.isBusiness ? company.name : "",
    address: billing ? company.billingAddress : (user.address ?? ""),
    postcode: billing ? company.billingPostcode : (user.postcode ?? ""),
    city: billing ? company.billingCity : (user.city ?? ""),
    country: company.country,
    vatNumber: company.vatNumber ?? "",
    vatStatus: company.vatStatus,
    invoiceEmail: company.invoiceEmail ?? "",
  };
}
