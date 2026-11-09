import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageSeo, getPublicPage, isAdminPreview } from "@/lib/cms/content";
import { safeHref } from "@/lib/cms/resolve";
import { ButtonLink, Chips, Eyebrow, Faq, Section, SectionTitle } from "@/components/public/ui";
import { Blocks, asItems, asLink, asList, asStr } from "@/components/public/cms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("uitbesteden");
  return { title: { absolute: seo.title }, description: seo.description };
}

export default async function OutsourcePage({ searchParams }: Props) {
  const preview = await isAdminPreview(await searchParams);
  const page = await getPublicPage("uitbesteden", preview);
  if (!page) notFound();
  const b = page.blocks;

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        hero: () => {
          const b1 = asLink(b.hero.button1);
          const b2 = asLink(b.hero.button2);
          return (
            <Section tone="mist">
              <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <Chips items={asList(b.hero.chips)} />
                  <h1 className="mt-6 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
                    {asStr(b.hero.title)}
                  </h1>
                  <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">{asStr(b.hero.intro)}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {b1.label && <ButtonLink href={safeHref(b1.href)}>{b1.label}</ButtonLink>}
                    {b2.label && (
                      <ButtonLink href={safeHref(b2.href)} variant="outline">
                        {b2.label}
                      </ButtonLink>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-pub-line border-l-8 border-l-pub-green bg-white p-7 shadow-[0_24px_48px_-30px_rgba(43,42,38,.3)] sm:p-9">
                  <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-green">{asStr(b.hero.cardLabel)}</div>
                  <ul className="mt-4 grid gap-3 text-[15.5px] text-[#374151]">
                    {asList(b.hero.cardPoints).map((t) => (
                      <li key={t} className="flex gap-3">
                        <span className="font-bold text-pub-green">✓</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          );
        },
        steps: () => (
          <Section>
            <Eyebrow>{asStr(b.steps.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.steps.title)}</SectionTitle>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {asItems<{ title: string; text: string }>(b.steps.items).map((s, i) => (
                <div key={i} className="rounded-2xl border border-pub-line bg-white p-6">
                  <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mt-3 text-[18px] font-bold text-pub-ink">{s.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{s.text}</p>
                </div>
              ))}
            </div>
          </Section>
        ),
        forWho: () => (
          <Section tone="mist">
            <Eyebrow>{asStr(b.forWho.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.forWho.title)}</SectionTitle>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {asItems<{ title: string; text: string }>(b.forWho.items).map((f, i) => (
                <div key={i} className="rounded-2xl border border-pub-line bg-white p-6">
                  <h3 className="text-[18px] font-bold text-pub-ink">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{f.text}</p>
                </div>
              ))}
            </div>
          </Section>
        ),
        faq: () => (
          <Section>
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
