"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleCheck, ExternalLink, Info } from "lucide-react";
import AddToCartButton from "./AddToCartButton";
import CountryFlag from "@/components/CountryFlag";
import { DESKTOP_COLUMNS } from "@/lib/marketplace";
import { hasPeriod } from "@/lib/placementPeriod";

export type SiteRowData = {
  websiteProductId: string;
  domain: string;
  category: string;
  language: string;
  country: string;
  countryCode: string;
  description: string | null;
  domainRating: number | null;
  domainAuthority: number | null;
  traffic: number | null;
  referringDomains: number | null;
  trustFlow: number | null;
  citationFlow: number | null;
  ipAddress: string | null;
  behindCloudflare: boolean;
  // Whether Google's AI cites the site as a source; null when not known.
  aiCited: boolean | null;
  price: number;
};

const ROW_GRID = `grid grid-cols-[minmax(0,1fr)_auto_24px] ${DESKTOP_COLUMNS} gap-x-3 items-center`;

const nl = (n: number | null) => (n == null ? "—" : n.toLocaleString("nl-NL"));

export default function SiteRow({
  site,
  type,
  initiallyOpen = false,
}: {
  site: SiteRowData;
  type: "BLOG_POST" | "HOMEPAGE_LINK";
  // The site picked on the dashboard (the eye): shown open, on top.
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  // A homepage link is paid per year; a blog article's price needs no note.
  const priceNote = hasPeriod(type) ? "per jaar" : null;

  const action = (
    <div onClick={(e) => e.stopPropagation()}>
      <AddToCartButton websiteProductId={site.websiteProductId} />
    </div>
  );

  // Opened, the row gets a border in the action colour, like its Voeg toe button.
  return (
    <div
      className={`bg-surface border rounded-xl mt-2 transition-shadow ${
        open ? "border-[color-mix(in_srgb,var(--btn-pay-bg)_40%,transparent)] shadow-md" : "border-line hover:shadow-sm"
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
          </div>
          <div className="md:hidden text-xs text-inkSoft mt-0.5 truncate">
            €{site.price.toFixed(0)} {priceNote && `${priceNote} `}· DR {nl(site.domainRating)}
          </div>
        </div>
        {[site.domainRating, site.domainAuthority, site.trustFlow, site.citationFlow].map((value, i) => (
          <div key={i} className="hidden md:block text-center text-sm text-ink tabular-nums">
            {nl(value)}
          </div>
        ))}
        <div className="hidden md:block text-center">
          <div className="text-sm text-ink">€{site.price.toFixed(0)}</div>
          {priceNote && <div className="text-xs text-inkSoft">{priceNote}</div>}
        </div>
        <div className="text-right">{action}</div>
        <ChevronDown size={18} className={`text-inkSoft justify-self-center transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 border-t border-line bg-brandSoft/20 px-4 sm:px-5 py-5 rounded-b-xl text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft mb-2">Over deze website</div>
            {site.description && <p className="text-ink/80 leading-relaxed mb-4">{site.description}</p>}
            <div className="font-semibold text-ink mb-2">Categorieën</div>
            <span className="inline-block rounded-full bg-[var(--pay-soft)] px-3 py-1 text-[var(--btn-pay-bg)]">
              {site.category}
            </span>
            <div className="font-semibold text-ink mt-4 mb-2">Taal</div>
            <div className="flex items-center gap-2 text-ink/80">
              <CountryFlag code={site.countryCode} label={site.country} />
              {site.language}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft mb-2">Cijfers</div>
            {(
              [
                ["Domain Rating (DR)", nl(site.domainRating)],
                ["Domain Authority (DA)", nl(site.domainAuthority)],
                ["Trust Flow (TF)", nl(site.trustFlow)],
                ["Citation Flow (CF)", nl(site.citationFlow)],
                ["Verkeer per maand", nl(site.traffic)],
                ["Verwijzende domeinen", nl(site.referringDomains)],
                ...(site.ipAddress
                  ? [["IP-adres", site.behindCloudflare ? `${site.ipAddress} (Cloudflare)` : site.ipAddress]]
                  : []),
                ...(site.aiCited !== null
                  ? [
                      [
                        <span key="ai" className="inline-flex items-center gap-1">
                          AI-Cited
                          <span title="Google AI (AI Overviews of AI Mode) noemt deze website als bron">
                            <Info size={13} className="text-inkSoft/70" />
                          </span>
                        </span>,
                        site.aiCited ? (
                          <CircleCheck size={17} className="text-emerald-600" aria-label="Ja" />
                        ) : (
                          "Nee"
                        ),
                      ],
                    ]
                  : []),
              ] as [ReactNode, ReactNode][]
            ).map(([label, value], i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-line">
                <span className="text-inkSoft">{label}</span>
                <span className="text-ink tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
