"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { saveAccountDetailsAction } from "./actions";
import { Card, Field, Message, SubmitButton } from "./ui";

export type DetailsValues = {
  name: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
  isBusiness: boolean;
  companyName: string;
  vatNumber: string;
  sameAddress: boolean;
  billingAddress: string;
  billingPostcode: string;
  billingCity: string;
};

type TextField = { [K in keyof DetailsValues]: DetailsValues[K] extends string ? K : never }[keyof DetailsValues];

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--btn-pay-bg)] peer-focus-visible:ring-offset-1 ${
          checked ? "bg-[var(--btn-pay-bg)] text-white" : "border-[1.5px] border-gray-400 bg-white"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

// "Mijn gegevens": name and address first, then — for ordering as a
// business — the company, at the same address or its own.
export default function MyDetailsForm({ initial }: { initial: DetailsValues }) {
  const router = useRouter();
  const { update } = useSession();
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (patch: Partial<DetailsValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setMessage(null);
  };
  const bind = (name: TextField) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [name]: e.target.value }),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await saveAccountDetailsAction(values);
      if (!result.success || !result.saved) {
        setMessage({ ok: false, text: result.error ?? "Opslaan mislukt." });
        return;
      }
      const saved = result.saved;
      // Shown as saved: postcode "1234 AB", VAT number in capitals.
      setValues((v) => ({
        ...v,
        name: saved.name,
        address: saved.address,
        postcode: saved.postcode,
        city: saved.city,
        phone: saved.phone ?? "",
        ...(saved.isBusiness ? { vatNumber: saved.vatNumber ?? "" } : {}),
        ...(saved.isBusiness && !saved.sameAddress
          ? { billingAddress: saved.billingAddress, billingPostcode: saved.billingPostcode, billingCity: saved.billingCity }
          : {}),
      }));
      // The top bar shows the company name (or, privately, the own name).
      await update({ name: saved.name, companyName: saved.isBusiness ? saved.companyName : saved.name });
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
        description="Je naam en adres."
        footer={
          <>
            <Message message={message} />
            <SubmitButton loading={loading}>Opslaan</SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Naam" required autoComplete="name" {...bind("name")} />
          <Field label="Adres" required placeholder="Straat en huisnummer" autoComplete="street-address" {...bind("address")} />
          <Field label="Postcode" required placeholder="1234 AB" autoComplete="postal-code" {...bind("postcode")} />
          <Field label="Plaats" required autoComplete="address-level2" {...bind("city")} />
          <Field label="Telefoonnummer" type="tel" autoComplete="tel" placeholder="06 12345678" hint="Optioneel" {...bind("phone")} />

          <div className="border-t border-line pt-5">
            <Checkbox checked={values.isBusiness} onChange={(isBusiness) => set({ isBusiness })}>
              Ik bestel zakelijk
              <span className="font-normal text-inkSoft">— de factuur komt op naam van je bedrijf</span>
            </Checkbox>
          </div>

          {values.isBusiness && (
            <div className="space-y-4 rounded-xl border border-line bg-gray-50/70 p-4">
              <h3 className="font-serif text-lg text-ink">Bedrijfsgegevens</h3>
              <Field label="Bedrijfsnaam" required autoComplete="organization" {...bind("companyName")} />
              <Field label="BTW-nummer" placeholder="NL123456789B01" hint="Optioneel" {...bind("vatNumber")} />
              <Checkbox checked={values.sameAddress} onChange={(sameAddress) => set({ sameAddress })}>
                Zelfde adres als hierboven
              </Checkbox>
              {!values.sameAddress && (
                <>
                  <Field label="Adres" required placeholder="Straat en huisnummer" {...bind("billingAddress")} />
                  <Field label="Postcode" required placeholder="1234 AB" {...bind("billingPostcode")} />
                  <Field label="Plaats" required {...bind("billingCity")} />
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </form>
  );
}
