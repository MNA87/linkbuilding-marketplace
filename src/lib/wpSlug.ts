const SPECIAL_LETTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  Æ: "ae",
  ø: "o",
  Ø: "o",
  œ: "oe",
  Œ: "oe",
  ł: "l",
  Ł: "l",
  đ: "d",
  Đ: "d",
};

// Close to WordPress's own sanitize_title(), but exact parity isn't needed:
// this slug is sent to the plugin as the post's post_name, so what the
// customer sees in the preview is what WordPress gets.
export function wpSlugify(title: string): string {
  return title
    .replace(/[ßæÆøØœŒłŁđĐ]/g, (c) => SPECIAL_LETTERS[c] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ –—/.]/g, "-")
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 190)
    .replace(/^-+|-+$/g, "");
}

// Only structures whose sole tag is %postname% are predictable before
// publishing — dates or a category would depend on things not known yet.
export function blogUrlTemplate(
  homeUrl: string | null,
  permalinkStructure: string | null,
  articleUrlBase: string | null = null
): string | null {
  // A site with a fixed start of its article URLs (Website.articleUrlBase).
  if (articleUrlBase) return `${articleUrlBase.replace(/\/+$/, "")}/%postname%/`;
  if (!homeUrl || !permalinkStructure) return null;
  const tags: string[] = permalinkStructure.match(/%[a-z_]+%/g) ?? [];
  if (!tags.includes("%postname%") || tags.some((t) => t !== "%postname%")) return null;
  const path = permalinkStructure.startsWith("/") ? permalinkStructure : `/${permalinkStructure}`;
  return homeUrl.replace(/\/+$/, "") + path;
}

export function fillBlogUrl(template: string, title: string): string | null {
  const slug = wpSlugify(title);
  return slug ? template.replace("%postname%", slug) : null;
}

// The slug an article goes out with: the admin's own choice, or else the
// one made from the title.
export function articleSlugOf(item: { articleSlug: string | null; articleTitle: string | null }): string {
  return wpSlugify(item.articleSlug || item.articleTitle || "");
}

// Everything before the slug in an article's URL, as far as it can be known
// before it's placed: "https://a2f.nl/" for most sites, and for sites with
// the category in their URLs (/%category%/%postname%/) the chosen category,
// e.g. "https://nugevonden.nl/marketing/". Null when it can't be told.
export function articleUrlPrefix(
  homeUrl: string | null,
  permalinkStructure: string | null,
  categoryName: string | null,
  articleUrlBase: string | null = null
): string | null {
  if (articleUrlBase) return `${articleUrlBase.replace(/\/+$/, "")}/`;
  if (!homeUrl || !permalinkStructure) return null;
  const tags: string[] = permalinkStructure.match(/%[a-z_]+%/g) ?? [];
  if (!tags.includes("%postname%") || tags.some((t) => t !== "%postname%" && t !== "%category%")) return null;
  const category = tags.includes("%category%") ? wpSlugify(categoryName ?? "") : "";
  if (tags.includes("%category%") && !category) return null;
  const path = permalinkStructure.startsWith("/") ? permalinkStructure : `/${permalinkStructure}`;
  const before = path.split("%postname%")[0].replace("%category%", category);
  return homeUrl.replace(/\/+$/, "") + before;
}
