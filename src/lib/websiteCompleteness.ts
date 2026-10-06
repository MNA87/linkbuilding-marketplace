// What a website still misses before it looks complete in the marketplace
// overview — shown in Admin → Websites as "mist …" so nothing is forgotten.
// The description is optional, so it doesn't count.
export function missingDetails(site: {
  maxLinks: number | null;
  exampleUrl: string | null;
  hasMetrics: boolean;
  offeredProducts: number;
}): string[] {
  const missing: string[] = [];
  if (site.offeredProducts === 0) missing.push("prijs");
  if (!site.hasMetrics) missing.push("cijfers");
  if (site.maxLinks == null) missing.push("max links");
  if (!site.exampleUrl) missing.push("voorbeeldartikel");
  return missing;
}
