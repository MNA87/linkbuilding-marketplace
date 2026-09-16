// Publishes an order's article straight to a website's WordPress install via
// the core REST API (wp-json/wp/v2/posts), authenticated with a WordPress
// Application Password (Users -> Profile -> Application Passwords) — never
// the account's real login password.

import { getArticleImageBuffer } from "@/lib/upload";

type WordPressSite = {
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
  publishBridgeSecret?: string | null;
};
type MaybeWordPressSite = {
  wordpressUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
  publishBridgeSecret?: string | null;
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

// Node's default fetch User-Agent is generic enough that some hosts' bot
// protection (seen on a SiteGround-hosted site) flags it as a scraper and
// blocks it with a CAPTCHA challenge instead of reaching WordPress at all.
// A real, identifiable User-Agent avoids that.
const USER_AGENT = "NugevondenPublisher/1.0 (+https://nugevonden.nl)";

// A 2xx response from WordPress isn't always JSON — a plugin conflict, a PHP
// warning printed before the real output, or (most commonly) permalinks set
// to "Plain" instead of "Post name" all make /wp-json/... fall through to an
// HTML page while still returning 200. Reading the body as text first turns
// that into a clear message instead of the browser's cryptic
// "Unexpected token '<' ... is not valid JSON".
async function parseJsonResponse<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${context} gaf geen geldig antwoord terug (status ${res.status}) — controleer of Instellingen -> Permalinks op deze WordPress-site niet op "Gewoon" staat: ${text.slice(0, 300)}`
    );
  }
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
      "User-Agent": USER_AGENT,
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WordPress media-upload mislukt (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = await parseJsonResponse<{ id?: number }>(res, "WordPress media-upload");
  return data.id;
}

// Some hosts (seen on a SiteGround-hosted site) run bot protection that
// blocks any request to /wp-json/... outright, no matter the User-Agent or
// credentials — a CAPTCHA challenge page comes back instead of ever
// reaching WordPress. When that's the case, a small custom plugin
// (wordpress-plugin/nugevonden-publish-bridge.php) exposes one endpoint
// outside /wp-json/, authenticated with its own shared secret instead of
// the WordPress Application Password. Sites without that plugin installed
// keep using the standard REST API below.
async function publishViaBridge(
  site: { wordpressUrl: string; publishBridgeSecret: string },
  article: { title: string; body: string; targetUrl: string; anchorText: string; imageKey?: string | null }
): Promise<{ liveUrl: string }> {
  const endpoint = `${site.wordpressUrl.replace(/\/$/, "")}/nugevonden-publish`;
  const content = buildContentWithLink(article.body, article.targetUrl, article.anchorText);

  const formData = new FormData();
  formData.set("title", article.title);
  formData.set("content", content);

  if (article.imageKey) {
    const { buffer, contentType } = await getArticleImageBuffer(article.imageKey);
    formData.set("image", new Blob([new Uint8Array(buffer)], { type: contentType }), article.imageKey);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Nugevonden-Secret": site.publishBridgeSecret,
      "User-Agent": USER_AGENT,
    },
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Publiceren via bridge mislukt (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await parseJsonResponse<{ url?: string }>(res, "Nugevonden publish bridge");
  if (!data.url) {
    throw new Error("Publish bridge gaf geen live URL terug.");
  }
  return { liveUrl: data.url };
}

export async function publishToWordPress(
  site: WordPressSite,
  article: { title: string; body: string; targetUrl: string; anchorText: string; imageKey?: string | null }
): Promise<{ liveUrl: string }> {
  if (site.publishBridgeSecret) {
    return publishViaBridge({ wordpressUrl: site.wordpressUrl, publishBridgeSecret: site.publishBridgeSecret }, article);
  }

  const endpoint = `${site.wordpressUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
  const featuredMediaId = article.imageKey ? await uploadFeaturedImage(site, article.imageKey) : undefined;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(site),
      "User-Agent": USER_AGENT,
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

  const data = await parseJsonResponse<{ link?: string }>(res, "WordPress publish");
  if (!data.link) {
    throw new Error("WordPress publish gaf geen live URL terug.");
  }
  return { liveUrl: data.link };
}
