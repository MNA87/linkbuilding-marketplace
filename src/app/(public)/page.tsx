import type { Metadata } from "next";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PUBLIC_LINKS, PUBLIC_SITE } from "@/lib/publicSite";
import { ButtonLink, Chips, Eyebrow, Faq, PriceCards, Section, SectionTitle } from "@/components/public/ui";
import marktplaats from "./_assets/marktplaats.png";
import stapSelecteren from "./_assets/stap-selecteren.png";
import stapInvullen from "./_assets/stap-invullen.png";
import stapBevestigen from "./_assets/stap-bevestigen.png";

export const metadata: Metadata = {
  title: { absolute: "Publito — Backlinks direct bij de bron" },
};

const USPS = [
  {
    n: "01",
    title: `Kies uit ${PUBLIC_SITE.siteCount} sites`,
    text: "Filter op niche, DR, verkeer en prijs. Alles vooraf zichtbaar, geen verrassingen achteraf.",
  },
  {
    n: "02",
    title: "Bestel op rekening",
    text: "Voor bureaus: één verzamelfactuur per maand, geen betaling op het moment zelf.",
    sand: true,
  },
  {
    n: "03",
    title: "Artikel inbegrepen",
    text: "Lever zelf aan of laat ons een redactioneel artikel schrijven, met afbeelding.",
  },
  {
    n: "04",
    title: "Snel geplaatst",
    text: "Status per plaatsing in je dashboard, van bestelling tot live.",
  },
];

const STEPS = [
  { n: "01 — Selecteren", title: "Kies je sites", text: "Niche, DR, verkeer en prijs per site.", img: stapSelecteren },
  { n: "02 — Invullen", title: "Lever je inhoud", text: "Eigen tekst, Google Doc, of wij schrijven.", img: stapInvullen },
  { n: "03 — Bevestigen", title: "Bevestig en volg", text: "Op rekening of direct. Live‑status per link.", img: stapBevestigen },
];

const GOOD = [
  "Gecontroleerde sites met eigen bezoekers",
  "DR, verkeer en niche vooraf zichtbaar",
  "Uniek artikel, geschreven voor die publisher",
  "Prijs per site, geen marge van een tussenpersoon",
];
const BAD = [
  "Onbekend waar je link komt te staan",
  "Opgeblazen metrics, nauwelijks bezoekers",
  "Gespinde of gekopieerde content",
  "Marge op marge, zonder inzicht",
];

const FAQ = [
  {
    q: "Moet ik zelf de content schrijven?",
    a: "Nee. Wij schrijven standaard een redactioneel artikel met afbeelding, zonder extra kosten. Zelf aanleveren (tekst of Google Doc) kan ook.",
  },
  {
    q: "Zijn dit echte sites met bezoekers?",
    a: "Ja. Elke site in de marktplaats is gecontroleerd op echt verkeer, een eigen redactie en een natuurlijk linkprofiel. Sites die niet (meer) voldoen, halen we eruit.",
  },
  {
    q: "Hoe snel staat mijn link live?",
    a: "De meeste plaatsingen staan binnen enkele werkdagen online. Je volgt de status per link in je dashboard en krijgt bericht zodra het artikel live staat.",
  },
  {
    q: "Kan ik op rekening bestellen?",
    a: "Ja. Bureaus en vaste klanten kunnen op rekening bestellen en ontvangen één verzamelfactuur per maand. Direct betalen kan natuurlijk ook.",
  },
  {
    q: "Wat is het verschil tussen een bloglink en een homepagelink?",
    a: "Een bloglink is een artikel met jouw link dat permanent online blijft. Een homepagelink staat op de voorpagina van de site en wordt per jaar afgenomen.",
  },
];

export default async function HomePage() {
  // Ingelogde gebruikers gaan direct door naar hun eigen omgeving.
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(session.user.role === "admin" ? "/admin" : session.user.role === "supplier" ? "/supplier" : "/marketplace");
  }

  return (
    <>
      {/* Hero */}
      <Section className="!pb-12 sm:!pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <Chips items={[`${PUBLIC_SITE.siteCount} sites`, "NL · BE", "Content inbegrepen"]} />
            <h1 className="isolate mt-6 font-display text-[42px] leading-[1.08] tracking-[-.04em] text-pub-ink sm:text-[58px] lg:text-[64px]">
              Google vindt je.
              <br />
              <mark className="relative -z-10 bg-transparent bg-[linear-gradient(transparent_62%,#ebe6da_62%)] px-1 text-pub-ink">AI noemt je.</mark>
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">
              Backlinks op gecontroleerde sites met echte bezoekers — zodat zoekmachines én AI‑assistenten jouw merk
              kennen. Artikel inbegrepen, direct bij de bron.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={PUBLIC_LINKS.register}>Bekijk {PUBLIC_SITE.siteCount} sites</ButtonLink>
              <ButtonLink href={PUBLIC_LINKS.contact} variant="outline">
                Gratis linkbuilding‑analyse
              </ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t border-pub-line pt-6">
              {[
                [PUBLIC_SITE.siteCount, "sites"],
                [PUBLIC_SITE.placementCount, "plaatsingen"],
                [`€ ${PUBLIC_SITE.priceBlogFrom}`, "vanaf · incl. content"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-[26px] leading-none tracking-[-.03em] text-pub-ink sm:text-[30px]">{v}</dt>
                  <dd className="mt-1.5 text-[13px] text-pub-soft">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-[#e0e3e1] bg-[#eceeec] p-3 sm:p-5">
              <Image
                src={marktplaats}
                alt="De Publito marktplaats: lijst met sites, DR, verkeer en prijs"
                priority
                unoptimized
                className="w-full rounded-2xl border border-[#d9e0dc] shadow-[0_1px_2px_rgba(0,0,0,.05),0_30px_60px_-34px_rgba(0,0,0,.35)]"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* USP's */}
      <Section tone="mist">
        <Eyebrow>Kies, bestel, live</Eyebrow>
        <SectionTitle>Zo maken we linkbuilding simpel.</SectionTitle>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USPS.map((u) => (
            <div
              key={u.n}
              className={`rounded-2xl border p-6 ${
                u.sand ? "border-pub-stoneLine bg-pub-stone" : "border-pub-line bg-white"
              }`}
            >
              <div className={`text-xs font-bold tracking-[.08em] ${u.sand ? "text-pub-green" : "text-[#9aa39f]"}`}>{u.n}</div>
              <h3 className="mt-3 text-[18px] font-bold text-pub-ink">{u.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{u.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Zo werkt het */}
      <Section id="zo-werkt-het">
        <Eyebrow>Zo werkt het</Eyebrow>
        <SectionTitle>Drie stappen. Eén dashboard.</SectionTitle>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="overflow-hidden rounded-2xl border border-pub-line bg-white">
              <div className="border-b border-pub-line bg-pub-mist p-3">
                <Image src={s.img} alt={s.title} unoptimized className="w-full rounded-lg border border-pub-line" />
              </div>
              <div className="p-6">
                <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">{s.n}</div>
                <h3 className="mt-2 text-[18px] font-bold text-pub-ink">{s.title}</h3>
                <p className="mt-1.5 text-[14.5px] text-[#4b5563]">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Geen reseller */}
      <Section tone="mist">
        <Eyebrow>Geen reseller</Eyebrow>
        <SectionTitle>Waarom je beter direct bij de bron bestelt.</SectionTitle>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-pub-green bg-white p-7">
            <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-green">Publito</div>
            <h3 className="mt-2 text-[22px] font-bold text-pub-ink">Direct bij de website</h3>
            <ul className="mt-5 grid gap-3 text-[15px] text-[#374151]">
              {GOOD.map((g) => (
                <li key={g} className="flex gap-3">
                  <span className="font-bold text-pub-green">✓</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-pub-line bg-white p-7">
            <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">Reseller / linkfarm</div>
            <h3 className="mt-2 text-[22px] font-bold text-pub-ink">Via een tussenlaag</h3>
            <ul className="mt-5 grid gap-3 text-[15px] text-[#4b5563]">
              {BAD.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="font-bold text-[#b91c1c]">✕</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Prijzen */}
      <Section id="prijzen">
        <div className="text-center">
          <Eyebrow>Prijzen</Eyebrow>
          <SectionTitle>Eerlijke prijzen, per plaatsing.</SectionTitle>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] text-[#4b5563] sm:text-[17px]">
            Geen abonnement, geen setupkosten. Het artikel zit erbij.
          </p>
        </div>
        <PriceCards priceBlogFrom={PUBLIC_SITE.priceBlogFrom} priceHomepageFrom={PUBLIC_SITE.priceHomepageFrom} />
      </Section>

      {/* FAQ */}
      <Section tone="mist">
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle>Veelgestelde vragen</SectionTitle>
        </div>
        <Faq items={FAQ} />
      </Section>

    </>
  );
}
