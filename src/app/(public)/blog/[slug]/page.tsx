import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminPreview } from "@/lib/cms/content";
import { getPublishedPost, imagesForBlocks, relatedPosts } from "@/lib/cms/blogContent";
import { Section } from "@/components/public/ui";
import BlogBlocks from "@/components/public/BlogBlocks";
import PostCard, { fmtDate } from "@/components/public/PostCard";
import PreviewBridge from "@/components/public/PreviewBridge";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Bericht niet gevonden" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  return {
    title: { absolute: title.includes("Publito") ? title : `${title} · Publito` },
    description,
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
      images: post.image ? [{ url: post.image.url, alt: post.image.alt }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const preview = await isAdminPreview(await searchParams);
  const post = await getPublishedPost(slug, preview);
  if (!post) notFound();
  const [images, related] = await Promise.all([imagesForBlocks(post.content), relatedPosts(slug)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: "Publito" },
    publisher: { "@type": "Organization", name: "Publito" },
    image: post.image ? [post.image.url] : undefined,
    mainEntityOfPage: `/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Section tone="mist" className="!pb-10 sm:!pb-12">
        <div className="mx-auto max-w-[760px]">
          <nav className="text-[13px] text-pub-soft" aria-label="Kruimelpad">
            <Link href="/blog" className="hover:text-pub-green">
              Blog
            </Link>
            {post.categories[0] && (
              <>
                <span className="mx-2">/</span>
                <Link href={`/blog?categorie=${encodeURIComponent(post.categories[0].slug)}`} className="hover:text-pub-green">
                  {post.categories[0].name}
                </Link>
              </>
            )}
          </nav>
          <h1 className="mt-4 font-display text-[36px] leading-[1.06] tracking-[-.035em] text-pub-ink sm:text-[48px]">{post.title}</h1>
          {post.excerpt && <p className="mt-5 text-[18px] leading-relaxed text-[#374151] sm:text-[20px]">{post.excerpt}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-pub-soft">
            {post.authorName && <span className="font-semibold text-pub-ink">{post.authorName}</span>}
            {post.authorName && <span>·</span>}
            <time dateTime={post.publishedAt ?? undefined}>{fmtDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{post.readingMinutes} min lezen</span>
            {preview && post.status !== "published" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Concept · voorbeeld</span>}
          </div>
        </div>
      </Section>

      <Section className="!pt-10">
        <div className="mx-auto max-w-[760px]">
          {post.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image.url} alt={post.image.alt} width={post.image.width ?? undefined} height={post.image.height ?? undefined} className="mb-10 w-full rounded-2xl border border-pub-line" />
          )}
          <BlogBlocks blocks={post.content} images={images} />
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="mist">
          <h2 className="font-display text-[26px] font-extrabold tracking-[-.02em] text-pub-ink">Lees ook</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </Section>
      )}
      {preview && <PreviewBridge />}
    </>
  );
}
