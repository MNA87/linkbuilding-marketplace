import { notFound } from "next/navigation";
import { getPublicPage, isAdminPreview } from "@/lib/cms/content";
import { Eyebrow, Section } from "./ui";
import { Blocks, Paragraphs, asStr } from "./cms";

// Privacybeleid en voorwaarden: één kopblok met een optionele gele melding.
export default async function LegalPage({
  slug,
  searchParams,
}: {
  slug: "privacy" | "voorwaarden";
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const preview = await isAdminPreview(searchParams);
  const page = await getPublicPage(slug, preview);
  if (!page) notFound();
  const c = page.blocks.content;
  const notice = asStr(c.notice).trim();

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        content: () => (
          <Section>
            <div className="mx-auto max-w-[720px]">
              <Eyebrow>{asStr(c.eyebrow)}</Eyebrow>
              <h1 className="mt-3 font-display text-[36px] leading-[1.06] tracking-[-.035em] text-pub-ink sm:text-[44px]">
                {asStr(c.title)}
              </h1>
              {notice && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>
              )}
              <div className="mt-6">
                <Paragraphs text={asStr(c.text)} className="text-[16px] leading-relaxed text-[#374151]" />
              </div>
            </div>
          </Section>
        ),
      }}
    />
  );
}
