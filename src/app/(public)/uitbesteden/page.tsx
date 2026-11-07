import type { Metadata } from "next";
import { PUBLIC_LINKS, PUBLIC_SITE } from "@/lib/publicSite";
import { ButtonLink, Chips, Eyebrow, Faq, Section, SectionTitle } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "Linkbuilding uitbesteden",
  description:
    "Geen tijd om zelf sites te kiezen? Wij stellen een linkplan op, schrijven de artikelen en plaatsen de links. Jij ziet alles in je dashboard.",
};

const STEPS = [
  {
    n: "01",
    title: "Intake en analyse",
    text: "We kijken naar je site, je concurrenten en je huidige linkprofiel. Daaruit volgt welke niches en welk type links het meest opleveren.",
  },
  {
    n: "02",
    title: "Linkplan op maat",
    text: "Je krijgt een concreet voorstel: welke sites, welke ankerteksten, welk tempo en wat het kost. Pas na jouw akkoord gaan we plaatsen.",
  },
  {
    n: "03",
    title: "Schrijven en plaatsen",
    text: "Onze redactie schrijft de artikelen, wij regelen de plaatsing en controleren elke link. Alles verschijnt in je dashboard.",
  },
  {
    n: "04",
    title: "Rapportage en bijsturen",
    text: "Maandelijks een overzicht van geplaatste links en resultaat. Op basis daarvan sturen we het plan bij.",
  },
];

const FOR_WHO = [
  { title: "Ondernemers", text: "Je wilt groeien in Google en AI‑zoekmachines, maar hebt geen tijd om zelf links te kopen en teksten te laten schrijven." },
  { title: "Marketingteams", text: "Linkbuilding is één van je kanalen, niet je dagtaak. Wij leveren de links, jij houdt het overzicht." },
  { title: "Bureaus", text: "Whitelabel uitvoering voor jouw klanten, op rekening, met één verzamelfactuur per maand." },
];

const FAQ = [
  {
    q: "Wat kost linkbuilding uitbesteden?",
    a: `Je betaalt per geplaatste link, tegen dezelfde prijzen als in de marktplaats (bloglinks vanaf € ${PUBLIC_SITE.priceBlogFrom}). Het linkplan en het schrijven van de artikelen zijn inbegrepen. Geen abonnement.`,
  },
  {
    q: "Zit ik ergens aan vast?",
    a: "Nee. Je geeft per plan akkoord en kunt op elk moment pauzeren of stoppen. Geplaatste bloglinks blijven gewoon staan.",
  },
  {
    q: "Mag ik meekijken en bijsturen?",
    a: "Ja. Je ziet elk voorstel vooraf en elke plaatsing in je dashboard. Wil je een site of ankertekst anders? Dan passen we dat aan.",
  },
  {
    q: "Werken jullie ook voor bureaus?",
    a: "Ja, veel bureaus laten de uitvoering aan ons over. We werken whitelabel en op rekening, met één factuur per maand.",
  },
];

export default function OutsourcePage() {
  return (
    <>
      <Section tone="mist">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Chips items={["Linkplan op maat", "Artikelen inbegrepen", "Maandelijkse rapportage"]} />
            <h1 className="mt-6 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
              Laat linkbuilding aan ons over.
            </h1>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">
              Geen tijd om zelf sites te kiezen en teksten te laten schrijven? Wij stellen een linkplan op, schrijven de
              artikelen en plaatsen de links. Jij ziet alles terug in je dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={PUBLIC_LINKS.contact}>Gratis linkbuilding‑analyse</ButtonLink>
              <ButtonLink href={PUBLIC_LINKS.prices} variant="outline">
                Bekijk prijzen
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-3xl border border-pub-line border-l-8 border-l-pub-green bg-white p-7 shadow-[0_24px_48px_-30px_rgba(43,42,38,.3)] sm:p-9">
            <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-green">Wat je krijgt</div>
            <ul className="mt-4 grid gap-3 text-[15.5px] text-[#374151]">
              {[
                "Analyse van je site en concurrenten",
                "Linkplan met sites, ankerteksten en tempo",
                "Redactionele artikelen, geschreven door onze redactie",
                "Plaatsing en controle van elke link",
                "Maandelijkse rapportage in je dashboard",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="font-bold text-pub-green">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>Zo werkt het</Eyebrow>
        <SectionTitle>Van intake tot rapportage.</SectionTitle>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-pub-line bg-white p-6">
              <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">{s.n}</div>
              <h3 className="mt-3 text-[18px] font-bold text-pub-ink">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="mist">
        <Eyebrow>Voor wie</Eyebrow>
        <SectionTitle>Uitbesteden past bij…</SectionTitle>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FOR_WHO.map((f) => (
            <div key={f.title} className="rounded-2xl border border-pub-line bg-white p-6">
              <h3 className="text-[18px] font-bold text-pub-ink">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle>Vragen over uitbesteden</SectionTitle>
        </div>
        <Faq items={FAQ} />
      </Section>

    </>
  );
}
