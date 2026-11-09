import Link from "next/link";
import type { ReactNode } from "react";
import { parseInline, safeLink, type Block, type InlineNode } from "@/lib/cms/blog";

// Rendert de blokken van een blogbericht op de publieke site. De opmaak
// (klassen) komt overeen met de editor, zodat wat je schrijft is wat je ziet.

type Img = { url: string; alt: string; width?: number | null; height?: number | null };

export function Inline({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return n.text;
      case "strong":
        return (
          <strong key={i} className="font-semibold text-pub-ink">
            <Inline nodes={n.children} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <Inline nodes={n.children} />
          </em>
        );
      case "link":
        return n.href.startsWith("/") ? (
          <Link key={i} href={n.href} className="font-medium text-pub-green underline decoration-pub-green/40 underline-offset-2 hover:decoration-pub-green">
            <Inline nodes={n.children} />
          </Link>
        ) : (
          <a key={i} href={n.href} rel="noopener" className="font-medium text-pub-green underline decoration-pub-green/40 underline-offset-2 hover:decoration-pub-green">
            <Inline nodes={n.children} />
          </a>
        );
    }
  });
}

export const Text = ({ text }: { text: string }) => <Inline nodes={parseInline(text)} />;

export default function BlogBlocks({ blocks, images }: { blocks: Block[]; images: Map<string, Img> | Record<string, Img> }) {
  const img = (id: string | null) => (id ? (images instanceof Map ? images.get(id) : images[id]) ?? null : null);
  return (
    <div className="grid gap-5">
      {blocks.map((b) => {
        switch (b.type) {
          case "paragraph":
            return b.text.trim() ? (
              <p key={b.id} className="text-[17px] leading-[1.7] text-[#374151]">
                <Text text={b.text} />
              </p>
            ) : null;
          case "heading":
            return b.level === 2 ? (
              <h2 key={b.id} className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-[-.02em] text-pub-ink">
                <Text text={b.text} />
              </h2>
            ) : (
              <h3 key={b.id} className="mt-3 font-display text-[21px] font-extrabold leading-tight tracking-[-.01em] text-pub-ink">
                <Text text={b.text} />
              </h3>
            );
          case "quote":
            return (
              <blockquote key={b.id} className="border-l-4 border-pub-green pl-5 text-[19px] italic leading-[1.6] text-pub-ink">
                <Text text={b.text} />
                {b.cite && <footer className="mt-1 text-[14px] not-italic text-pub-soft">— {b.cite}</footer>}
              </blockquote>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={b.id} className={`grid gap-1.5 pl-6 text-[17px] leading-[1.7] text-[#374151] ${b.ordered ? "list-decimal" : "list-disc"} marker:text-pub-green`}>
                {b.items.filter((it) => it.trim()).map((it, i) => (
                  <li key={i}>
                    <Text text={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "image": {
            const m = img(b.mediaId);
            if (!m) return null;
            return (
              <figure key={b.id} className="my-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={b.alt || m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" className="w-full rounded-xl border border-pub-line" />
                {b.caption && <figcaption className="mt-2 text-center text-[13px] text-pub-soft">{b.caption}</figcaption>}
              </figure>
            );
          }
          case "button": {
            const href = safeLink(b.href);
            if (!b.label || !href) return null;
            return (
              <p key={b.id} className="my-2">
                <Link href={href} className="inline-flex items-center rounded-xl bg-pub-green px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-pub-greenDark">
                  {b.label}
                </Link>
              </p>
            );
          }
        }
      })}
    </div>
  );
}
