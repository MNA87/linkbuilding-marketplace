import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageSeo, getPublicPage, isAdminPreview } from "@/lib/cms/content";
import { listCategories, listPublishedPosts } from "@/lib/cms/blogContent";
import { Eyebrow, Section } from "@/components/public/ui";
import { Blocks, asStr } from "@/components/public/cms";
import PostCard from "@/components/public/PostCard";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("blog");
  return { title: { absolute: seo.title }, description: seo.description };
}

export default async function BlogIndex({ searchParams }: Props) {
  const params = await searchParams;
  const preview = await isAdminPreview(params);
  const category = typeof params.categorie === "string" ? params.categorie : undefined;
  const [page, posts, categories] = await Promise.all([getPublicPage("blog", preview), listPublishedPosts(category), listCategories()]);
  if (!page) notFound();
  const b = page.blocks;
  const used = new Set(posts.flatMap((p) => p.categories.map((c) => c.slug)));
  const allPosts = category ? await listPublishedPosts() : posts;
  const chips = categories.filter((c) => allPosts.some((p) => p.categories.some((x) => x.slug === c.slug)) || used.has(c.slug));

  return (
    <Blocks
      page={page}
      preview={preview}
      render={{
        header: () => (
          <Section tone="mist" className="!pb-10 sm:!pb-12">
            <div className="max-w-[760px]">
              <Eyebrow>{asStr(b.header.eyebrow)}</Eyebrow>
              <h1 className="mt-3 font-display text-[40px] leading-[1.04] tracking-[-.035em] text-pub-ink sm:text-[54px]">{asStr(b.header.title)}</h1>
              <p className="mt-5 text-[17px] leading-relaxed text-[#374151] sm:text-[18px]">{asStr(b.header.intro)}</p>
            </div>
            {chips.length > 0 && (
              <nav className="mt-8 flex flex-wrap gap-2" aria-label="Categorieën">
                <Link href="/blog" className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${!category ? "border-pub-ink bg-pub-ink text-white" : "border-pub-line bg-white text-pub-ink hover:border-pub-green"}`}>
                  Alles
                </Link>
                {chips.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/blog?categorie=${encodeURIComponent(c.slug)}`}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${category === c.slug ? "border-pub-ink bg-pub-ink text-white" : "border-pub-line bg-white text-pub-ink hover:border-pub-green"}`}
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
          </Section>
        ),
        list: () => (
          <Section className="!pt-10">
            {posts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-pub-line p-10 text-center text-[16px] text-pub-soft">{asStr(b.list.empty)}</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((p, i) => (
                  <PostCard key={p.id} post={p} featured={i === 0 && !category} />
                ))}
              </div>
            )}
          </Section>
        ),
      }}
    />
  );
}
