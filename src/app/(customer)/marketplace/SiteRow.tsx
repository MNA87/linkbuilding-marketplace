"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, Flame } from "lucide-react";
import AddToCartButton from "./AddToCartButton";
import { DESKTOP_COLUMNS } from "@/lib/marketplace";

export type SiteRowData = {
  websiteProductId: string;
  domain: string;
  category: string;
  language: string;
  country: string;
  description: string | null;
  domainRating: number | null;
  domainAuthority: number | null;
  traffic: number | null;
  referringDomains: number | null;
  price: number;
  popular: boolean;
  isNew: boolean;
  inCart: boolean;
};

const ROW_GRID = `grid grid-cols-[minmax(0,1fr)_auto_24px] ${DESKTOP_COLUMNS} gap-x-3 items-center`;

const nl = (n: number | null) => (n == null ? "—" : n.toLocaleString("nl-NL"));

const PERKS = {
  BLOG_POST: ["Dofollow link, 1 tot 3 jaar online", "Zelf een datum kiezen", "Zelf schrijven, of wij schrijven het"],
  HOMEPAGE_LINK: ["Link op de voorpagina, in een rubriek", "1 tot 3 jaar online", "Direct online na betaling"],
} as const;

export default function SiteRow({
  site,
  type,
  writingPrice,
}: {
  site: SiteRowData;
  type: "BLOG_POST" | "HOMEPAGE_LINK";
  writingPrice: number;
}) {
  const [open, setOpen] = useState(false);
  const perks = PERKS[type].map((p) =>
    p === "Zelf schrijven, of wij schrijven het" && writingPrice > 0 ? `${p} (+ €${writingPrice.toFixed(0)})` : p
  );

  const action = site.inCart ? (
    <Link
      href="/dashboard/cart"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
    >
      <Check size={14} strokeWidth={2.5} />
      In mandje
    </Link>
  ) : (
    <div onClick={(e) => e.stopPropagation()}>
      <AddToCartButton websiteProductId={site.websiteProductId} label="Bestellen" />
    </div>
  );

  return (
    <div
      className={`bg-surface border rounded-xl mt-2 transition-shadow ${
        open ? "border-brand/40 shadow-md" : site.inCart ? "border-emerald-200" : "border-line hover:shadow-sm"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`${ROW_GRID} cursor-pointer px-4 sm:px-5 py-3.5`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-ink truncate">{site.domain}</span>
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${site.domain} bekijken`}
              className="hidden sm:block text-inkSoft hover:text-brand shrink-0"
            >
              <ExternalLink size={13} />
            </a>
            {site.popular && (
              <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                <Flame size={11} />
                Populair
              </span>
            )}
            {site.isNew && !site.popular && (
              <span className="hidden sm:inline shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Nieuw
              </span>
            )}
          </div>
          <div className="text-xs text-inkSoft mt-0.5 truncate">
            <span className="hidden md:inline">{site.category}</span>
            <span className="md:hidden">
              €{site.price.toFixed(0)} per jaar · DR {nl(site.domainRating)}
            </span>
          </div>
        </div>
        <div className="hidden md:block text-center text-sm text-ink">{nl(site.domainRating)}</div>
        <div className="hidden md:block text-center text-sm text-ink">{nl(site.traffic)}</div>
        <div className="hidden md:block text-center">
          <div className="text-sm text-ink">€{site.price.toFixed(0)}</div>
          <div className="text-xs text-inkSoft">per jaar</div>
        </div>
        <div className="text-right">{action}</div>
        <ChevronDown size={18} className={`text-inkSoft justify-self-center transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="grid gap-6 md:gap-8 md:grid-cols-[1.3fr_1fr_1fr] border-t border-line bg-brandSoft/20 px-4 sm:px-5 py-5 rounded-b-xl text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft mb-2">Over deze website</div>
            <p className="text-ink/80 leading-relaxed">
              {site.description || `${site.category} · ${site.language} · ${site.country}`}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft mb-2">Cijfers</div>
            {[
              ["Domain Rating", site.domainRating],
              ["Domain Authority", site.domainAuthority],
              ["Verkeer per maand", site.traffic],
              ["Verwijzende domeinen", site.referringDomains],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between py-1.5 border-b border-dashed border-line">
                <span className="text-inkSoft">{label}</span>
                <span className="text-ink">{nl(value as number | null)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft mb-2">Wat je krijgt</div>
            <ul className="space-y-1.5">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-2 text-ink/80">
                  <Check size={14} strokeWidth={2.5} className="text-emerald-600 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
