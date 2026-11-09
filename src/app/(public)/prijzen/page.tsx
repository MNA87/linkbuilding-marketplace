import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageSeo, getPublicPage, getSiteSettings, isAdminPreview } from "@/lib/cms/content";
import { Eyebrow, Faq, PriceCards, Section, SectionTitle, type PriceCard } from "@/components/public/ui";
import { Blocks, asItems, asStr } from "@/components/public/cms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("prijzen");
  return { title: { absolute: seo.title }, description: seo.description };
}

export default async function PricesPage({ searchParams }: Props) {
  const preview = await isAdminPreview(await searchParams);
  const [page, { settings }] = await Promise.all([getPublicPage("prijzen", preview), getSiteSettings()]);
  if (!page) notFound();
  const b = page.blocks;

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        header: () => (
          <Section tone="mist" className="!pb-10 sm:!pb-12">
            <div className="mx-auto max-w-[720px] text-center">
              <Eyebrow>{asStr(b.header.eyebrow)}</Eyebrow>
              <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
                {asStr(b.header.title)}
              </h1>
              <p className="mt-5 text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">{asStr(b.header.intro)}</p>
            </div>
          </Section>
        ),
        cards: () => (
          <Section className="!pt-10">
            <PriceCards cards={asItems<PriceCard>(settings.prijskaarten.cards)} note={asStr(settings.prijskaarten.note)} />
          </Section>
        ),
        included: () => (
          <Section tone="mist">
            <Eyebrow>{asStr(b.included.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.included.title)}</SectionTitle>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {asItems<{ title: string; text: string }>(b.included.items).map((i, n) => (
                <div key={n} className="rounded-2xl border border-pub-line bg-white p-6">
                  <h3 className="text-[17px] font-bold text-pub-ink">{i.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{i.text}</p>
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
