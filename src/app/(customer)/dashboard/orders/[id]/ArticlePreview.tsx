"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// The article as it goes on the site: folded to a short preview (image,
// title, opening lines) and opened in full on request. The HTML is the
// stored article body, sanitized when it was saved.
export default function ArticlePreview({
  title,
  html,
  imageUrl,
  excerpt,
}: {
  title: string;
  html: string;
  imageUrl: string | null;
  excerpt: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open ? (
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full gap-4 rounded-xl border border-line p-3 text-left transition-colors hover:bg-gray-50"
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover sm:h-24 sm:w-36" />
          )}
          <span className="min-w-0">
            <span className="block font-serif text-lg leading-snug text-ink">{title}</span>
            <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-inkSoft">{excerpt}</span>
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brandSoft/40 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brandSoft"
      >
        {open ? (
          <>
            Inklappen <ChevronUp size={15} />
          </>
        ) : (
          <>
            Lees het hele artikel <ChevronDown size={15} />
          </>
        )}
      </button>
    </div>
  );
}
