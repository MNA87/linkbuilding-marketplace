import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageSeo, getPublicPage, isAdminPreview } from "@/lib/cms/content";
import { Eyebrow, Section, SectionTitle } from "@/components/public/ui";
import { Blocks, Paragraphs, asItems, asStr } from "@/components/public/cms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("over-ons");
  return { title: { absolute: seo.title }, description: seo.description };
}

export default async function AboutPage({ searchParams }: Props) {
  const preview = await isAdminPreview(await searchParams);
  const page = await getPublicPage("over-ons", preview);
  if (!page) notFound();
  const b = page.blocks;

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        intro: () => (
          <Section tone="mist">
            <div className="mx-auto max-w-[760px]">
              <Eyebrow>{asStr(b.intro.eyebrow)}</Eyebrow>
              <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">
                {asStr(b.intro.title)}
              </h1>
              <div className="mt-5">
                <Paragraphs text={asStr(b.intro.text)} className="text-[17px] leading-relaxed text-[#374151] sm:text-[18px]" />
              </div>
            </div>
          </Section>
        ),
        values: () => (
          <Section>
            <Eyebrow>{asStr(b.values.eyebrow)}</Eyebrow>
            <SectionTitle>{asStr(b.values.title)}</SectionTitle>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {asItems<{ title: string; text: string }>(b.values.items).map((v, i) => (
                <div key={i} className="rounded-2xl border border-pub-line bg-white p-7">
                  <div className="text-xs font-bold tracking-[.08em] text-pub-leaf">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mt-3 text-[20px] font-bold text-pub-ink">{v.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4b5563]">{v.text}</p>
                </div>
              ))}
            </div>
          </Section>
        ),
        publishers: () => (
          <Section tone="mist">
            <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <Eyebrow>{asStr(b.publishers.eyebrow)}</Eyebrow>
                <SectionTitle>{asStr(b.publishers.title)}</SectionTitle>
              </div>
              <div>
                <Paragraphs text={asStr(b.publishers.text)} className="text-[16px] leading-relaxed text-[#374151] sm:text-[17px]" />
              </div>
            </div>
          </Section>
        ),
      }}
    />
  );
}
