"use client";

import { useState } from "react";
import { CONTACT_SUBJECTS, contactSchema, type ContactSubject } from "@/lib/validations/contact";
import { contactAction } from "./actions";

const FIELD =
  "w-full rounded-xl border border-[#d6dadf] bg-white px-4 py-3 text-[15px] text-pub-ink outline-none transition placeholder:text-[#9aa3a0] focus:border-pub-green focus:ring-2 focus:ring-pub-green/20";
const LABEL = "mb-1.5 block text-[13.5px] font-semibold text-pub-ink";

export default function ContactForm({ defaultSubject = "analyse" }: { defaultSubject?: ContactSubject }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    subject: defaultSubject,
    message: "",
    fax: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }
    setLoading(true);
    try {
      const result = await contactAction(parsed.data);
      if (result.ok) setDone(result.message);
      else setError(result.message);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#cfe3d8] bg-pub-mint p-6 text-[15.5px] text-pub-greenDark" role="status">
        {done}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800" role="alert">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={LABEL}>
            Naam
          </label>
          <input id="c-name" className={FIELD} autoComplete="name" required value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label htmlFor="c-email" className={LABEL}>
            E-mailadres
          </label>
          <input
            id="c-email"
            type="email"
            className={FIELD}
            autoComplete="email"
            required
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div>
          <label htmlFor="c-company" className={LABEL}>
            Bedrijf <span className="font-normal text-pub-soft">(optioneel)</span>
          </label>
          <input id="c-company" className={FIELD} autoComplete="organization" value={form.company} onChange={set("company")} />
        </div>
        <div>
          <label htmlFor="c-website" className={LABEL}>
            Website <span className="font-normal text-pub-soft">(optioneel)</span>
          </label>
          <input
            id="c-website"
            className={FIELD}
            autoComplete="url"
            placeholder="jouwsite.nl"
            value={form.website}
            onChange={set("website")}
          />
        </div>
      </div>
      <div>
        <label htmlFor="c-subject" className={LABEL}>
          Waar gaat het over?
        </label>
        <select id="c-subject" className={FIELD} value={form.subject} onChange={set("subject")}>
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="c-message" className={LABEL}>
          Bericht
        </label>
        <textarea
          id="c-message"
          className={`${FIELD} min-h-[140px] resize-y`}
          required
          value={form.message}
          onChange={set("message")}
          placeholder="Vertel kort over je site, je doel en waar je hulp bij zoekt."
        />
      </div>
      {/* Honeypot — verborgen voor mensen, bots vullen hem wel in. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="c-fax">Fax</label>
        <input id="c-fax" tabIndex={-1} autoComplete="off" value={form.fax} onChange={set("fax")} />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl bg-pub-green px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-pub-greenDark disabled:opacity-60"
      >
        {loading ? "Bezig…" : "Verstuur bericht"}
      </button>
      <p className="text-[12.5px] text-pub-soft">
        We gebruiken je gegevens alleen om te reageren op je bericht. Zie ons{" "}
        <a href="/privacy" className="underline hover:text-pub-ink">
          privacybeleid
        </a>
        .
      </p>
    </form>
  );
}
