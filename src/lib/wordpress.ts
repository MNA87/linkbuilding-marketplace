// Publishes an order's article straight to a website's WordPress install via
// the core REST API (wp-json/wp/v2/posts), authenticated with a WordPress
// Application Password (Users -> Profile -> Application Passwords) — never
// the account's real login password.

import { getArticleImageBuffer } from "@/lib/upload";

type WordPressSite = {
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
};
type MaybeWordPressSite = {
  wordpressUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
};

export function isWordPressConfigured(site: MaybeWordPressSite): site is MaybeWordPressSite & WordPressSite {
  return Boolean(site.wordpressUrl && site.wordpressUsername && site.wordpressAppPassword);
}

// Puts the backlink inline in the article: if the customer already linked it
// themselves in the rich text editor, leave the body as-is (avoids a nested
// <a> inside their own link); otherwise wrap the anchor text where it
// already appears, or append a closing paragraph with the link when the
// writer didn't work it in themselves.
function buildContentWithLink(body: string, targetUrl: string, anchorText: string): string {
  if (body.includes(`href="${targetUrl}"`)) {
    return body;
  }
  const link = `<a href="${targetUrl}">${anchorText}</a>`;
  if (body.includes(anchorText)) {
    return body.replace(anchorText, link);
  }
  return `${body}\n\n<p>${link}</p>`;
}

function authHeader(site: WordPressSite): string {
  return `Basic ${Buffer.from(`${site.wordpressUsername}:${site.wordpressAppPassword}`).toString("base64")}`;
}

// The order's featured image lives in our own private storage (see
// src/lib/upload.ts), served in-app through a URL that keeps working
// forever by re-signing itself on every view. That trick doesn't help a
// WordPress post, which needs to render for good on a site we don't
// control — so before publishing, it's uploaded into that site's own Media
// Library and set as the post's native featured image (not embedded inline
// in the body), which is what WordPress themes already know how to display.
async function uploadFeaturedImage(site: WordPressSite, imageKey: string): Promise<number | undefined> {
  const { buffer, contentType } = await getArticleImageBuffer(imageKey);
  const mediaEndpoint = `${site.wordpressUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`;
  const res = await fetch(mediaEndpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader(site),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${imageKey}"`,
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WordPress media-upload mislukt (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: number };
  return data.id;
}

export async function publishToWordPress(
  site: WordPressSite,
  article: { title: string; body: string; targetUrl: string; anchorText: string; imageKey?: string | null }
): Promise<{ liveUrl: string }> {
  const endpoint = `${site.wordpressUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
  const featuredMediaId = article.imageKey ? await uploadFeaturedImage(site, article.imageKey) : undefined;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(site),
    },
    body: JSON.stringify({
      title: article.title,
      content: buildContentWithLink(article.body, article.targetUrl, article.anchorText),
      status: "publish",
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WordPress publish mislukt (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { link?: string };
  if (!data.link) {
    throw new Error("WordPress publish gaf geen live URL terug.");
  }
  return { liveUrl: data.link };
}
