import type { Metadata } from "next";
import { PUBLIC_SITE } from "@/lib/publicSite";
import { CONTACT_SUBJECTS, type ContactSubject } from "@/lib/validations/contact";
import { Eyebrow, Section } from "@/components/public/ui";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Vraag een gratis linkbuilding‑analyse aan, overleg over uitbesteden of meld je site aan als publisher. We reageren binnen twee werkdagen.",
};

const isSubject = (v: unknown): v is ContactSubject => CONTACT_SUBJECTS.some((s) => s.value === v);

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ onderwerp?: string }> }) {
  const { onderwerp } = await searchParams;
  const defaultSubject = isSubject(onderwerp) ? onderwerp : "analyse";

  return (
    <Section tone="mist">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[50px]">
            Laten we even sparren.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[#374151]">
            Wil je weten welke links jouw site verder helpen? Vraag een gratis analyse aan, of stel je vraag over
            uitbesteden, samenwerken als bureau of je site aanmelden als publisher. We reageren binnen twee werkdagen.
          </p>
          <dl className="mt-8 grid gap-5 text-[15px]">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">E-mail</dt>
              <dd className="mt-1">
                <a href={`mailto:${PUBLIC_SITE.contactEmail}`} className="font-semibold text-pub-ink hover:text-pub-green">
                  {PUBLIC_SITE.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">Bereikbaar</dt>
              <dd className="mt-1 text-[#374151]">Werkdagen van 9:00 tot 17:00</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">Werkgebied</dt>
              <dd className="mt-1 text-[#374151]">{PUBLIC_SITE.countries}</dd>
            </div>
          </dl>
        </div>
        <div className="relative rounded-3xl border border-pub-line bg-white p-6 sm:p-8">
          <ContactForm defaultSubject={defaultSubject} />
        </div>
      </div>
    </Section>
  );
}
