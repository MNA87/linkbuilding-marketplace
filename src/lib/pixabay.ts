const API_URL = "https://pixabay.com/api/";
// Pixabay's API terms require caching requests for 24 hours.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type PixabayHit = {
  id: number;
  pageURL: string;
  tags: string;
  webformatURL: string;
  largeImageURL: string;
  user: string;
};

export type StockPhoto = {
  id: number;
  thumbUrl: string;
  alt: string;
  photographer: string;
  pageUrl: string;
};

const cache = new Map<string, { at: number; hits: PixabayHit[]; totalHits: number }>();

export function pixabayConfigured(): boolean {
  return Boolean(process.env.PIXABAY_API_KEY);
}

async function query(params: Record<string, string>): Promise<{ hits: PixabayHit[]; totalHits: number }> {
  const cacheKey = JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("PIXABAY_API_KEY ontbreekt.");
  const res = await fetch(`${API_URL}?${new URLSearchParams({ key, ...params })}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pixabay gaf status ${res.status}`);
  const body = (await res.json()) as { hits?: PixabayHit[]; totalHits?: number };
  const entry = { at: Date.now(), hits: body.hits ?? [], totalHits: body.totalHits ?? 0 };

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, entry);
  return entry;
}

export function isPixabayUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && (hostname === "pixabay.com" || hostname.endsWith(".pixabay.com"));
  } catch {
    return false;
  }
}

export function toStockPhoto(hit: PixabayHit): StockPhoto {
  return {
    id: hit.id,
    // Pixabay serves other sizes by swapping the _640 suffix; 340px is
    // plenty for a thumbnail grid.
    thumbUrl: hit.webformatURL.replace("_640", "_340"),
    alt: hit.tags,
    photographer: hit.user,
    pageUrl: hit.pageURL,
  };
}

export async function searchPixabay(term: string, page: number) {
  const { hits, totalHits } = await query({
    q: term.slice(0, 100),
    lang: "nl",
    image_type: "photo",
    orientation: "horizontal",
    safesearch: "true",
    per_page: "12",
    page: String(page),
  });
  return { photos: hits.filter((h) => isPixabayUrl(h.webformatURL)).map(toStockPhoto), totalHits };
}

async function fetchImage(url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  if (!isPixabayUrl(url)) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return { bytes, type };
}

// Looked up by ID on Pixabay itself — the browser only ever sends an ID,
// never a URL, so the server can't be pointed at an arbitrary address.
// Pixabay forbids permanent hotlinking, so the caller stores the bytes.
export async function downloadPixabayImage(id: number): Promise<{ file: File; photographer: string }> {
  const { hits } = await query({ id: String(id) });
  const hit = hits[0];
  if (!hit) throw new Error("Foto niet gevonden op Pixabay.");

  // The 1280px version, falling back to 640px if it's over our 2MB limit.
  const image = (await fetchImage(hit.largeImageURL)) ?? (await fetchImage(hit.webformatURL));
  if (!image) throw new Error("Foto kon niet worden opgehaald.");

  const ext = image.type === "image/png" ? "png" : "jpg";
  const type = ext === "png" ? "image/png" : "image/jpeg";
  return { file: new File([image.bytes], `pixabay-${hit.id}.${ext}`, { type }), photographer: hit.user };
}
