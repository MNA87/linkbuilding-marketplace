import sanitizeHtml from "sanitize-html";

// The rich text editor's HTML comes from the browser, so it's never trusted
// as-is — strip everything except the formatting the editor itself can
// produce before this ever reaches the database, the admin dashboard, or a
// live WordPress post.
export function sanitizeArticleBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "a",
      "span",
      "mark",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^left$|^center$|^right$|^justify$/] },
      span: { color: [/^#[0-9a-f]{3,8}$/i] },
      mark: { "background-color": [/^#[0-9a-f]{3,8}$/i] },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}
