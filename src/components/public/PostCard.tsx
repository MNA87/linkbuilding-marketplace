import Link from "next/link";
import type { PostSummary } from "@/lib/cms/blogContent";

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }) : "";

export default function PostCard({ post, featured = false }: { post: PostSummary; featured?: boolean }) {
  return (
    <article className={`group overflow-hidden rounded-2xl border border-pub-line bg-white transition hover:border-pub-green ${featured ? "sm:col-span-2 lg:col-span-3 lg:grid lg:grid-cols-2" : ""}`}>
      <Link href={`/blog/${post.slug}`} className="block">
        <div className={`bg-pub-mist ${featured ? "aspect-[16/10] lg:h-full lg:aspect-auto" : "aspect-[16/10]"}`}>
          {post.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image.url} alt={post.image.alt} className="h-full w-full object-cover" loading={featured ? "eager" : "lazy"} />
          ) : (
            <div className="grid h-full place-items-center font-display text-[64px] text-pub-line">P</div>
          )}
        </div>
      </Link>
      <div className={`p-6 ${featured ? "lg:p-10" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold uppercase tracking-[.06em] text-pub-green">
          {post.categories.slice(0, 2).map((c) => (
            <Link key={c.slug} href={`/blog?categorie=${encodeURIComponent(c.slug)}`} className="hover:underline">
              {c.name}
            </Link>
          ))}
          <span className="font-normal normal-case tracking-normal text-pub-soft">
            {fmtDate(post.publishedAt)} · {post.readingMinutes} min
          </span>
        </div>
        <h2 className={`mt-3 font-display font-extrabold leading-[1.12] tracking-[-.025em] text-pub-ink ${featured ? "text-[30px] sm:text-[36px]" : "text-[22px]"}`}>
          <Link href={`/blog/${post.slug}`} className="group-hover:text-pub-green">
            {post.title}
          </Link>
        </h2>
        <p className={`mt-3 leading-relaxed text-[#4b5563] ${featured ? "text-[16.5px]" : "text-[15px]"}`}>{post.excerpt}</p>
        <Link href={`/blog/${post.slug}`} className="mt-4 inline-block text-[14px] font-semibold text-pub-green hover:underline">
          Lees verder →
        </Link>
      </div>
    </article>
  );
}
