// The kinds of product a website can offer, with their names in the admin.
// No database imports: used by client components too.
export const PRODUCT_TYPES = ["BLOG_POST", "HOMEPAGE_LINK"] as const;
export type ProductTypeKey = (typeof PRODUCT_TYPES)[number];
export const PRODUCT_NAMES: Record<ProductTypeKey, string> = { BLOG_POST: "Blogartikel", HOMEPAGE_LINK: "Homepage-link" };
