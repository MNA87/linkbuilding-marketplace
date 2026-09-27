"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { saveAccountDetailsAction } from "./actions";
import { Card, Field, Message, SubHeading, SubmitButton } from "./ui";

type Values = {
  name: string;
  phone: string;
  companyName: string;
  vatNumber: string;
  billingAddress: string;
  billingPostcode: string;
  billingCity: string;
};

// "Mijn gegevens": the person and the invoice details, saved in one go.
export default function MyDetailsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const { update } = useSession();
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const bind = (name: keyof Values) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setMessage(null);
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await saveAccountDetailsAction(values);
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Opslaan mislukt." });
        return;
      }
      if (result.values) setValues(result.values as Values);
      // The name and company name in the top bar come from the session.
      await update({ name: result.values?.name, companyName: result.values?.companyName });
      router.refresh();
      setMessage({ ok: true, text: "Opgeslagen." });
    } catch {
      setMessage({ ok: false, text: "Opslaan mislukt. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card
        title="Mijn gegevens"
        description="Je naam en hoe we je kunnen bereiken."
        footer={
          <>
            <Message message={message} />
            <SubmitButton loading={loading}>Opslaan</SubmitButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Naam" required autoComplete="name" {...bind("name")} />
          <Field
            label="Telefoonnummer"
            type="tel"
            autoComplete="tel"
            placeholder="06 12345678"
            hint="Optioneel"
            {...bind("phone")}
          />
          <SubHeading title="Factuurgegevens" description="Dit komt op je facturen." />
          <Field label="Bedrijfsnaam" required autoComplete="organization" {...bind("companyName")} />
          <Field label="BTW-nummer" placeholder="NL123456789B01" hint="Optioneel" {...bind("vatNumber")} />
          <Field label="Adres" required wide placeholder="Straat en huisnummer" autoComplete="street-address" {...bind("billingAddress")} />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 sm:col-span-2">
            <Field label="Postcode" required placeholder="1234 AB" autoComplete="postal-code" {...bind("billingPostcode")} />
            <Field label="Plaats" required autoComplete="address-level2" {...bind("billingCity")} />
          </div>
        </div>
      </Card>
    </form>
  );
}
