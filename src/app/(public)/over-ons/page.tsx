import type { Metadata } from "next";
import { PUBLIC_SITE } from "@/lib/publicSite";
import { Eyebrow, Section, SectionTitle } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "Over ons",
  description:
    "Publito is een linkbuilding marktplaats uit Nederland. Gecontroleerde sites, eerlijke prijzen en direct contact met de bron — zonder tussenlaag.",
};

const VALUES = [
  {
    title: "Direct bij de bron",
    text: "We zijn geen reseller. Elke site in de marktplaats is aangesloten door de publisher zelf, met een eigen prijs. Zo weet je precies waar je link komt te staan.",
  },
  {
    title: "Gecontroleerd aanbod",
    text: "Sites komen pas in de marktplaats na controle op echt verkeer, een eigen redactie en een natuurlijk linkprofiel. Wie niet (meer) voldoet, gaat eruit.",
  },
  {
    title: "Transparante cijfers",
    text: "DR, verkeer, niche en prijs staan vooraf bij elke site. Geen geschatte waarden achteraf, geen verrassingen op de factuur.",
  },
  {
    title: "Content die past",
    text: "Een link werkt alleen in een artikel dat bij de site past. Daarom schrijven we per plaatsing een uniek, redactioneel artikel. Of je levert zelf aan.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Section tone="mist">
        <div className="mx-auto max-w-[760px]">
          <Eyebrow>Over Publito</Eyebrow>
          <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
            Linkbuilding zonder tussenlaag.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">
            Publito is ontstaan uit frustratie over de linkbuildingmarkt: onduidelijke prijzen, gekopieerde content en
            links op sites die niemand bezoekt. Wij wilden een plek waar je direct bij de publisher bestelt, vooraf ziet wat
            je krijgt en een artikel krijgt dat écht bij de site past.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">
            Vandaag plaatsen we links op {PUBLIC_SITE.siteCount} gecontroleerde sites in {PUBLIC_SITE.countries}, voor
            ondernemers, marketingteams en bureaus. Zelf kiezen in de marktplaats of alles uitbesteden: de prijs per link
            is hetzelfde.
          </p>
        </div>
      </Section>

      <Section>
        <Eyebrow>Waar we voor staan</Eyebrow>
        <SectionTitle>Vier afspraken die we niet loslaten.</SectionTitle>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <div key={v.title} className="rounded-2xl border border-pub-line bg-white p-7">
              <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">0{i + 1}</div>
              <h3 className="mt-3 text-[20px] font-bold text-pub-ink">{v.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4b5563]">{v.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="mist">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
          <div>
            <Eyebrow>Voor publishers</Eyebrow>
            <SectionTitle>Heb je zelf een site met bezoekers?</SectionTitle>
          </div>
          <div>
            <p className="text-[16px] leading-relaxed text-[#374151] sm:text-[17px]">
              Sluit je aan als publisher, bepaal zelf je prijs en ontvang bestellingen rechtstreeks in je eigen
              dashboard. Wij regelen de klant, de betaling en de content; jij plaatst het artikel. Interesse? Stuur een
              bericht via de contactpagina, dan nemen we de voorwaarden met je door.
            </p>
          </div>
        </div>
      </Section>

    </>
  );
}
