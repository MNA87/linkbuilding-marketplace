"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Info } from "lucide-react";
import { saveAccountDetailsAction } from "./actions";
import { COUNTRIES, isEuCountry } from "@/lib/countries";
import { vatStatusText } from "@/lib/vatRules";
import { Card, Field, Message, SubmitButton, inputClass } from "./ui";

// A select counts as read-only in CSS, so not inputClass's grey.
const selectClass = inputClass.replace(/\S*read-only:\S+/g, "");

export type DetailsValues = {
  name: string;
  // Shown only: changed under Account → Inloggen.
  email: string;
  phone: string;
  companyName: string;
  address: string;
  postcode: string;
  city: string;
  country: string;
  vatNumber: string;
  // Shown only: what the VIES check said (src/lib/vatCheck.ts).
  vatStatus: string;
  // Where the verzamelfactuur goes; empty = the email above.
  invoiceEmail: string;
};

type TextField = Exclude<
  { [K in keyof DetailsValues]: DetailsValues[K] extends string ? K : never }[keyof DetailsValues],
  "name" | "email" | "country" | "vatStatus"
>;

const Optional = ({ label }: { label: string }) => (
  <>
    {label} <span className="font-normal text-inkSoft">(optioneel)</span>
  </>
);

// "Mijn gegevens", for business customers only: the person, then the
// company (which is what goes on the invoices). Two fields to a row, so it
// all fits on one screen. Also asked in the cart before a first payment.
// "save": the admin filling them in for a customer, saved to that customer
// (not the session); "emailHint" goes under the e-mail address.
export default function MyDetailsForm({
  initial,
  title = "Mijn gegevens",
  description = "Jij en je bedrijf.",
  note,
  submitLabel = "Opslaan",
  save,
  emailHint = "Wijzigen kan bij Inloggen",
}: {
  initial: DetailsValues;
  title?: string;
  description?: string;
  note?: string;
  submitLabel?: string;
  save?: typeof saveAccountDetailsAction;
  emailHint?: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [values, setValues] = useState(initial);
  // One name in the database; on screen first and last name, as when
  // registering ("Nana Adjei" as last name stays together).
  const [firstName, setFirstName] = useState(initial.name.trim().split(/\s+/)[0] ?? "");
  const [lastName, setLastName] = useState(initial.name.trim().split(/\s+/).slice(1).join(" "));
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
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ ok: false, text: !firstName.trim() ? "Vul de voornaam in." : "Vul de achternaam in." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      // The company's address is the one on the invoices.
      const result = await (save ?? saveAccountDetailsAction)({
        ...values,
        name,
        isBusiness: true,
        sameAddress: true,
      });
      if (!result.success || !result.saved) {
        setMessage({ ok: false, text: result.error ?? "Opslaan mislukt." });
        return;
      }
      const saved = result.saved;
      // Shown as saved: postcode "1234 AB", VAT number in capitals.
      setValues((v) => ({
        ...v,
        name: saved.name,
        postcode: saved.postcode,
        vatStatus: result.vatStatus ?? v.vatStatus,
        ...(saved.isBusiness ? { vatNumber: saved.vatNumber ?? "" } : {}),
      }));
      // The top bar shows the company name.
      if (!save) await update({ name: saved.name, companyName: saved.isBusiness ? saved.companyName : saved.name });
      router.refresh();
      const vat = saved.isBusiness && saved.vatNumber ? vatStatusText(result.vatStatus ?? "") : null;
      setMessage(vat ? { ok: vat.ok, text: `Opgeslagen. ${vat.text}` } : { ok: true, text: "Opgeslagen." });
    } catch {
      setMessage({ ok: false, text: "Opslaan mislukt. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  const vat =
    values.vatNumber && values.country !== "NL" && isEuCountry(values.country) && vatStatusText(values.vatStatus);

  return (
    <form onSubmit={handleSubmit}>
      <Card
        title={title}
        description={description}
        footer={
          <>
            <Message message={message} />
            <SubmitButton loading={loading}>{submitLabel}</SubmitButton>
          </>
        }
      >
        {note && (
          <p className="mb-5 flex gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-inkSoft">
            <Info size={15} className="mt-px shrink-0" />
            {note}
          </p>
        )}

        <h3 className="mb-3 font-serif text-lg text-ink">Persoon</h3>
        {/* Two to a row; on a phone the short pairs (name, postcode and
            place) stay side by side and the rest takes the full width. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field
            label="Voornaam"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setMessage(null);
            }}
          />
          <Field
            label="Achternaam"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setMessage(null);
            }}
          />
          <div className="col-span-2 sm:col-span-1">
            <Field label="E-mailadres" value={values.email} readOnly hint={emailHint || undefined} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Telefoonnummer" type="tel" autoComplete="tel" placeholder="06 12345678" {...bind("phone")} />
          </div>
        </div>

        <div className="my-6 border-t border-line" />

        <h3 className="font-serif text-lg text-ink">Bedrijf</h3>
        <p className="mb-3 text-xs text-inkSoft">Dit staat op de facturen.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <Field label="Bedrijfsnaam" required autoComplete="organization" {...bind("companyName")} />
          </div>
          <div className="col-span-2">
            <Field
              label="Adres"
              required
              placeholder="Straat en huisnummer"
              autoComplete="street-address"
              {...bind("address")}
            />
          </div>
          <Field
            label="Postcode"
            required
            placeholder={values.country === "NL" ? "1234 AB" : undefined}
            autoComplete="postal-code"
            {...bind("postcode")}
          />
          <Field label="Plaats" required autoComplete="address-level2" {...bind("city")} />
          <label className="col-span-2 block sm:col-span-1">
            <span className="mb-1.5 block text-sm font-medium text-ink">Land</span>
            <select
              value={values.country}
              onChange={(e) => set({ country: e.target.value })}
              autoComplete="country"
              className={selectClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              <Optional label="BTW-nummer" />
            </span>
            <input
              {...bind("vatNumber")}
              placeholder={values.country === "NL" ? "NL123456789B01" : undefined}
              className={inputClass}
            />
            {values.country !== "NL" && isEuCountry(values.country) && (
              <span className="mt-1 block text-xs text-inkSoft">
                Met een geldig btw-nummer betaal je geen Nederlandse btw.
              </span>
            )}
            {vat && (
              <span className={`mt-1 block text-xs ${vat.ok ? "text-emerald-700" : "text-amber-700"}`}>{vat.text}</span>
            )}
          </label>
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              <Optional label="Facturen naar" />
            </span>
            <input
              type="email"
              {...bind("invoiceEmail")}
              placeholder="bijvoorbeeld boekhouding@bedrijf.nl"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-inkSoft">Leeg = {values.email}</span>
          </label>
        </div>
      </Card>
    </form>
  );
}
