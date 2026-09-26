import type { CSSProperties } from "react";
import { isHexColor, softColor } from "@/lib/buttonColors";

// One colour per kind of link — the accent and icons of blog links and of
// homepage links wherever they're shown (dashboard, Mijn orders), set in
// Admin → Instellingen → Kleuren per soort link.
export type LinkTypeColors = { blog: string; homepage: string };

export const DEFAULT_LINK_TYPE_COLORS: LinkTypeColors = { blog: "#2563eb", homepage: "#0d9488" };

export const LINK_TYPES: { key: keyof LinkTypeColors; label: string }[] = [
  { key: "blog", label: "Blog links" },
  { key: "homepage", label: "Homepage links" },
];

export function safeLinkTypeColors(colors: LinkTypeColors): LinkTypeColors {
  return {
    blog: isHexColor(colors.blog) ? colors.blog : DEFAULT_LINK_TYPE_COLORS.blog,
    homepage: isHexColor(colors.homepage) ? colors.homepage : DEFAULT_LINK_TYPE_COLORS.homepage,
  };
}

// CSS variables on <body>, read with e.g. `text-[var(--type-blog)]`.
export function linkTypeColorVars(colors: LinkTypeColors): CSSProperties {
  const { blog, homepage } = safeLinkTypeColors(colors);
  return {
    "--type-blog": blog,
    "--type-blog-soft": softColor(blog),
    "--type-homepage": homepage,
    "--type-homepage-soft": softColor(homepage),
  } as CSSProperties;
}
