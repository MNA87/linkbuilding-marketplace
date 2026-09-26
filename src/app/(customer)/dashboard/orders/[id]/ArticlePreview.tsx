// The article as it goes on the site, in full — the link's block on the
// order page is what folds it away. The HTML is the stored article body,
// sanitized when it was saved.
export default function ArticlePreview({
  title,
  html,
  imageUrl,
}: {
  title: string;
  html: string;
  imageUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="max-h-72 w-full object-cover" />
      )}
      <div className="px-5 py-4">
        <h3 className="font-serif text-xl text-ink">{title}</h3>
        <div className="prose-content mt-2 text-sm leading-relaxed text-ink/85" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
