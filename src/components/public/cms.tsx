import type { ReactNode } from "react";
import type { BlockDef, Resolved } from "@/lib/cms/types";
import PreviewBridge from "./PreviewBridge";

// Hulpjes om een publieke pagina uit het CMS te renderen. Elk blok krijgt een
// data-cms-block-attribuut, zodat de editor (Admin → Publieke site) in het
// live voorbeeld kan zien waar een blok staat en erop kan klikken.

type AnyResolved = Resolved<Record<string, BlockDef>>;

/** Rendert de blokken van een pagina in de ingestelde volgorde, zonder de verborgen blokken. */
export function Blocks({
  page,
  render,
  preview = false,
}: {
  page: AnyResolved;
  render: Record<string, () => ReactNode>;
  preview?: boolean;
}) {
  const hidden = new Set(page.hidden);
  return (
    <>
      {page.order.map((id) => {
        const r = render[id];
        if (!r || hidden.has(id)) return null;
        return (
          <div key={id} data-cms-block={id} className="relative">
            {r()}
          </div>
        );
      })}
      {preview && <PreviewBridge />}
    </>
  );
}

/** Splitst een tekstveld op lege regels in alinea's. */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <p key={i} className={`${className} ${i > 0 ? "mt-4" : ""}`}>
          {p}
        </p>
      ))}
    </>
  );
}

export const asStr = (v: unknown) => (typeof v === "string" ? v : "");
export const asList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const asItems = <T extends Record<string, unknown>>(v: unknown) =>
  (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []) as T[];
export const asLink = (v: unknown) => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { label: asStr(o.label), href: asStr(o.href) || "/" };
};
