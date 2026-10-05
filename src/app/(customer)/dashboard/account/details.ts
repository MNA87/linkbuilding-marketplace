import type { Company, User } from "@prisma/client";
import type { DetailsValues } from "./MyDetailsForm";

// What "Mijn gegevens" starts from — on Account, and in the cart while the
// invoice details are still missing. Customers from before the own-address
// fields have only the invoice address: that's theirs too, until they
// change it.
export function detailsOf(user: User, company: Company): DetailsValues {
  const hasOwn = Boolean(user.address);
  const own = hasOwn
    ? { address: user.address ?? "", postcode: user.postcode ?? "", city: user.city ?? "" }
    : { address: company.billingAddress, postcode: company.billingPostcode, city: company.billingCity };
  const sameAddress =
    own.address === company.billingAddress &&
    own.postcode === company.billingPostcode &&
    own.city === company.billingCity;
  return {
    name: user.name,
    ...own,
    phone: user.phone ?? "",
    country: company.country,
    vatStatus: company.vatStatus,
    isBusiness: company.isBusiness,
    companyName: company.isBusiness ? company.name : "",
    vatNumber: company.vatNumber ?? "",
    sameAddress,
    billingAddress: sameAddress ? "" : company.billingAddress,
    billingPostcode: sameAddress ? "" : company.billingPostcode,
    billingCity: sameAddress ? "" : company.billingCity,
  };
}
