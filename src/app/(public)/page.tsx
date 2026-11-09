import type { Metadata } from "next";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPageSeo, getPublicPage, getSiteSettings, isAdminPreview } from "@/lib/cms/content";
import { safeHref } from "@/lib/cms/resolve";
import { ButtonLink, Chips, Eyebrow, Faq, PriceCards, Section, SectionTitle, type PriceCard } from "@/components/public/ui";
import { Blocks, asItems, asLink, asList, asStr } from "@/components/public/cms";
import marktplaats from "./_assets/marktplaats.png";
import stapSelecteren from "./_assets/stap-selecteren.png";
import stapInvullen from "./_assets/stap-invullen.png";
import stapBevestigen from "./_assets/stap-bevestigen.png";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("home");
  return { title: { absolute: seo.title }, description: seo.description };
}

const STEP_IMAGES = [stapSelecteren, stapInvullen, stapBevestigen];

export default async function HomePage({ searchParams }: Props) {
  const preview = await isAdminPreview(await searchParams);

  // Ingelogde gebruikers gaan direct door naar hun eigen omgeving.
  if (!preview) {
    const session = await getServerSession(authOptions);
    if (session) {
      redirect(session.user.role === "admin" ? "/admin" : session.user.role === "supplier" ? "/supplier" : "/marketplace");
    }
  }

  const [page, { settings }] = await Promise.all([getPublicPage("home", preview), getSiteSettings()]);
  if (!page) redirect("/login");
  const b = page.blocks;
  const cards = asItems<PriceCard>(settings.prijskaarten.cards);

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        hero: () => {
          const b1 = asLink(b.hero.button1);
          const b2 = asLink(b.hero.button2);
          return (
            <Section className="!pb-12 sm:!pb-16">
              <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
                <div>
                  <Chips items={asList(b.hero.chips)} />
                  <h1 className="isolate mt-6 font-display text-[42px] leading-[1.08] tracking-[-.04em] text-pub-ink sm:text-[58px] lg:text-[64px]">
                    {asStr(b.hero.title1)}
                    <br />
                    <mark className="relative -z-10 bg-transparent bg-[linear-gradient(transparent_62%,#ebe6da_62%)] px-1 text-pub-ink">
                      {asStr(b.hero.title2)}
                    </mark>
                  </h1>
                  <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">{asStr(b.hero.intro)}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {b1.label && <ButtonLink href={safeHref(b1.href)}>{b1.label}</ButtonLink>}
                    {b2.label && (
                      <ButtonLink href={safeHref(b2.href)} variant="outline">
                        {b2.label}
                      </ButtonLink>
                    )}
                  </div>
                  <dl className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t border-pub-line pt-6">
                    {asItems<{ value: string; label: string }>(b.hero.stats).map((s, i) => (
                      <div key={i}>
                        <dt className="font-display text-[26px] leading-none tracking-[-.03em] text-pub-ink sm:text-[30px]">{s.value}</dt>
                        <dd className="mt-1.5 text-[13px] text-pub-soft">{s.label}</dd>
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
          );
        },

        usps: () => (
          <Section tone="mist">
            <Eyebrow>{asStr(b.usps.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.usps.title)}</SectionTitle>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {asItems<{ title: string; text: string; highlight: boolean }>(b.usps.items).map((u, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-6 ${u.highlight ? "border-pub-stoneLine bg-pub-stone" : "border-pub-line bg-white"}`}
                >
                  <div className={`text-xs font-bold tracking-[.08em] ${u.highlight ? "text-pub-green" : "text-[#9aa39f]"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-3 text-[18px] font-bold text-pub-ink">{u.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{u.text}</p>
                </div>
              ))}
            </div>
          </Section>
        ),

        steps: () => (
          <Section id="zo-werkt-het">
            <Eyebrow>{asStr(b.steps.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.steps.title)}</SectionTitle>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {asItems<{ label: string; title: string; text: string }>(b.steps.items).map((s, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-pub-line bg-white">
                  {STEP_IMAGES[i] && (
                    <div className="border-b border-pub-line bg-pub-mist p-3">
                      <Image src={STEP_IMAGES[i]} alt={s.title} unoptimized className="w-full rounded-lg border border-pub-line" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">{s.label}</div>
                    <h3 className="mt-2 text-[18px] font-bold text-pub-ink">{s.title}</h3>
                    <p className="mt-1.5 text-[14.5px] text-[#4b5563]">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ),

        compare: () => (
          <Section tone="mist">
            <Eyebrow>{asStr(b.compare.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.compare.title)}</SectionTitle>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border-2 border-pub-green bg-white p-7">
                <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-green">{asStr(b.compare.goodLabel)}</div>
                <h3 className="mt-2 text-[22px] font-bold text-pub-ink">{asStr(b.compare.goodTitle)}</h3>
                <ul className="mt-5 grid gap-3 text-[15px] text-[#374151]">
                  {asList(b.compare.goodPoints).map((g) => (
                    <li key={g} className="flex gap-3">
                      <span className="font-bold text-pub-green">✓</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-pub-line bg-white p-7">
                <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">{asStr(b.compare.badLabel)}</div>
                <h3 className="mt-2 text-[22px] font-bold text-pub-ink">{asStr(b.compare.badTitle)}</h3>
                <ul className="mt-5 grid gap-3 text-[15px] text-[#4b5563]">
                  {asList(b.compare.badPoints).map((x) => (
                    <li key={x} className="flex gap-3">
                      <span className="font-bold text-[#b91c1c]">✕</span>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        ),

        prices: () => (
          <Section id="prijzen">
            <div className="text-center">
              <Eyebrow>{asStr(b.prices.eyebrow)}</Eyebrow>
              <SectionTitle>{asStr(b.prices.title)}</SectionTitle>
              <p className="mx-auto mt-4 max-w-[46ch] text-[16px] text-[#4b5563] sm:text-[17px]">{asStr(b.prices.intro)}</p>
            </div>
            <PriceCards cards={cards} note={asStr(settings.prijskaarten.note)} />
          </Section>
        ),

        faq: () => (
          <Section tone="mist">
            <div className="text-center">
              <Eyebrow>{asStr(b.faq.eyebrow)}</Eyebrow>
              <SectionTitle>{asStr(b.faq.title)}</SectionTitle>
            </div>
            <Faq items={asItems<{ q: string; a: string }>(b.faq.items)} />
          </Section>
        ),
      }}
    />
  );
}
