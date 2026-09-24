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
export function blogUrlTemplate(homeUrl: string | null, permalinkStructure: string | null): string | null {
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
