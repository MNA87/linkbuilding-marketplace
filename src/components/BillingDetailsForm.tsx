import type { Company } from "@prisma/client";
import DetailsForm from "@/components/DetailsForm";
import { setBillingDetailsAction } from "@/app/(customer)/dashboard/account/actions";

export default function BillingDetailsForm({ company }: { company: Company }) {
  return (
    <DetailsForm
      action={setBillingDetailsAction}
      initialValues={{
        billingAddress: company.billingAddress,
        billingPostcode: company.billingPostcode,
        billingCity: company.billingCity,
        vatNumber: company.vatNumber ?? "",
      }}
      fields={[
        { name: "billingAddress", label: "Adres", placeholder: "Straat en huisnummer", wide: true },
        { name: "billingPostcode", label: "Postcode", placeholder: "1234 AB" },
        { name: "billingCity", label: "Plaats" },
        { name: "vatNumber", label: "BTW-nummer", placeholder: "NL123456789B01", optional: true, wide: true },
      ]}
    />
  );
}
