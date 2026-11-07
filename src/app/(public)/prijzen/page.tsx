import type { Metadata } from "next";
import { PUBLIC_SITE } from "@/lib/publicSite";
import { Eyebrow, Faq, PriceCards, Section, SectionTitle } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "Prijzen",
  description:
    "Transparante prijzen per plaatsing. Bloglinks vanaf € 35 (permanent), homepagelinks vanaf € 67 per jaar. Artikel inbegrepen, geen abonnement.",
};

const INCLUDED = [
  { title: "Redactioneel artikel", text: "Uniek geschreven voor de publisher, inclusief afbeelding. Of lever je eigen tekst aan." },
  { title: "Plaatsing en controle", text: "Wij regelen de plaatsing en controleren of de link correct en dofollow live staat." },
  { title: "Dashboard en rapportage", text: "Elke link met status, URL en datum op één plek. Exporteer wanneer je wilt." },
  { title: "Op rekening voor bureaus", text: "Eén verzamelfactuur per maand, zodat je niet per bestelling hoeft af te rekenen." },
];

const FAQ = [
  {
    q: "Waarom verschillen de prijzen per site?",
    a: "Elke publisher bepaalt zijn eigen prijs, op basis van autoriteit, verkeer en niche. In de marktplaats zie je per site precies wat een plaatsing kost — vóór je bestelt.",
  },
  {
    q: "Zijn er abonnements- of setupkosten?",
    a: "Nee. Je betaalt per plaatsing. Een account is gratis en je bekijkt het volledige aanbod zonder verplichtingen.",
  },
  {
    q: "Wat gebeurt er als een link offline gaat?",
    a: "Bloglinks blijven permanent staan. Verdwijnt een link toch, dan plaatsen we deze opnieuw of krijg je je geld terug.",
  },
  {
    q: "Krijgen bureaus korting?",
    a: "Bureaus met vaste afname krijgen een eigen tarief en kunnen op rekening bestellen. Neem contact op voor de mogelijkheden.",
  },
];

export default function PricesPage() {
  return (
    <>
      <Section tone="mist" className="!pb-10 sm:!pb-12">
        <div className="mx-auto max-w-[720px] text-center">
          <Eyebrow>Prijzen</Eyebrow>
          <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
            Betaal per plaatsing. Niets meer.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">
            Geen abonnement, geen setupkosten, geen verborgen marge. Je ziet per site wat een link kost en het artikel zit
            erbij.
          </p>
        </div>
      </Section>

      <Section className="!pt-10">
        <PriceCards priceBlogFrom={PUBLIC_SITE.priceBlogFrom} priceHomepageFrom={PUBLIC_SITE.priceHomepageFrom} />
      </Section>

      <Section tone="mist">
        <Eyebrow>Inbegrepen</Eyebrow>
        <SectionTitle>Wat je altijd krijgt.</SectionTitle>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((i) => (
            <div key={i.title} className="rounded-2xl border border-pub-line bg-white p-6">
              <h3 className="text-[17px] font-bold text-pub-ink">{i.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{i.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle>Vragen over prijzen</SectionTitle>
        </div>
        <Faq items={FAQ} />
      </Section>

    </>
  );
}
