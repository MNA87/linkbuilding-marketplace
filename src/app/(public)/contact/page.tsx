import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageSeo, getPublicPage, isAdminPreview } from "@/lib/cms/content";
import { CONTACT_SUBJECTS, type ContactSubject } from "@/lib/validations/contact";
import { Eyebrow, Section } from "@/components/public/ui";
import { Blocks, asItems, asStr } from "@/components/public/cms";
import ContactForm from "./ContactForm";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("contact");
  return { title: { absolute: seo.title }, description: seo.description };
}

const isSubject = (v: unknown): v is ContactSubject => CONTACT_SUBJECTS.some((s) => s.value === v);

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const preview = await isAdminPreview(params);
  const page = await getPublicPage("contact", preview);
  if (!page) notFound();
  const b = page.blocks;
  const defaultSubject = isSubject(params.onderwerp) ? params.onderwerp : "analyse";

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        intro: () => (
          <Section tone="mist">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
              <div>
                <Eyebrow>{asStr(b.intro.eyebrow)}</Eyebrow>
                <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[50px]">
                  {asStr(b.intro.title)}
                </h1>
                <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[#374151]">{asStr(b.intro.text)}</p>
                <dl className="mt-8 grid gap-5 text-[15px]">
                  {asItems<{ label: string; value: string }>(b.intro.details).map((d, i) => (
                    <div key={i}>
                      <dt className="text-xs font-bold uppercase tracking-[.08em] text-pub-soft">{d.label}</dt>
                      <dd className="mt-1 text-[#374151]">
                        {d.value.includes("@") ? (
                          <a href={`mailto:${d.value}`} className="font-semibold text-pub-ink hover:text-pub-green">
                            {d.value}
                          </a>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="relative rounded-3xl border border-pub-line bg-white p-6 sm:p-8">
                <ContactForm defaultSubject={defaultSubject} />
              </div>
            </div>
          </Section>
        ),
      }}
    />
  );
}
