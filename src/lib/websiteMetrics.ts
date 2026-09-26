import { promises as dns } from "node:dns";
import { prisma } from "@/lib/prisma";
import { findNumber, getApiKey } from "@/lib/apiCredentials";

// A website's figures, fetched automatically: Domain Rating, organic traffic
// and referring domains from Ahrefs; TF and CF (Majestic), DA and spam score
// (Moz) from SEO Metrics Checker; and the IP address, looked up ourselves.
// Each fetch is stored as a new WebsiteMetric row with source "auto".

const DAY_MS = 24 * 60 * 60 * 1000;
// How old the last automatic fetch may be before the monthly run redoes it.
export const REFRESH_AFTER_DAYS = 30;
// Sites refreshed per hourly run, so a month's work is spread out.
const PER_RUN = 20;

export type FetchedMetrics = {
  domainRating?: number;
  organicTraffic?: number;
  referringDomains?: number;
  domainAuthority?: number;
  trustFlow?: number;
  citationFlow?: number;
  spamScore?: number;
  ipAddress?: string;
  behindCloudflare?: boolean;
};

// "https://www.example.nl/pad" → "example.nl"
export function bareDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

// The first three parts of an IPv4 address: sites sharing it are on the
// same network ("C-class"), which looks less natural to Google.
export function cBlock(ip: string): string | null {
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : null;
}

// Cloudflare's published IPv4 ranges: a site behind them shows Cloudflare's
// address, not its own server's.
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function isCloudflareIp(ip: string): boolean {
  const n = ipToNumber(ip);
  if (n === null) return false;
  return CLOUDFLARE_RANGES.some((range) => {
    const [base, bits] = range.split("/");
    const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
    return ((n & mask) >>> 0) === ((ipToNumber(base)! & mask) >>> 0);
  });
}

export async function lookupIp(domain: string): Promise<FetchedMetrics> {
  const host = bareDomain(domain);
  for (const name of [host, `www.${host}`]) {
    try {
      const [ip] = await dns.resolve4(name);
      if (ip) return { ipAddress: ip, behindCloudflare: isCloudflareIp(ip) };
    } catch {
      // try the next name
    }
  }
  return {};
}

const today = () => new Date().toISOString().slice(0, 10);

async function ahrefsGet(path: string, params: Record<string, string>, key: string): Promise<unknown> {
  const url = `https://api.ahrefs.com/v3/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // Ahrefs explains a refusal in the body (never contains the key).
    const reason = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Ahrefs ${path}: ${res.status} ${reason}`);
  }
  return res.json();
}

export async function fetchAhrefsMetrics(domain: string, key: string): Promise<FetchedMetrics> {
  const target = bareDomain(domain);
  const base = { target, date: today() };
  const [rating, metrics, backlinks] = await Promise.all([
    ahrefsGet("site-explorer/domain-rating", base, key),
    ahrefsGet("site-explorer/metrics", { ...base, mode: "subdomains" }, key),
    ahrefsGet("site-explorer/backlinks-stats", { ...base, mode: "subdomains" }, key),
  ]);
  const found: FetchedMetrics = {
    domainRating: findNumber(rating, /^domain_rating$/) ?? undefined,
    organicTraffic: findNumber(metrics, /^org_traffic$/) ?? undefined,
    referringDomains: findNumber(backlinks, /^live_refdomains$/) ?? findNumber(backlinks, /refdomains/) ?? undefined,
  };
  if (found.domainRating === undefined || found.organicTraffic === undefined || found.referringDomains === undefined) {
    // Figures only, never the key: to see what Ahrefs sent.
    console.log(`metrics ${target}: unexpected Ahrefs answer`, JSON.stringify({ rating, metrics, backlinks }).slice(0, 600));
  }
  return found;
}

export async function fetchSeoMetrics(domain: string, key: string): Promise<FetchedMetrics> {
  const target = bareDomain(domain);
  const url = `https://www.seometricschecker.com/api/metrics.php?${new URLSearchParams({ type: "maj_moz_ss", key, url: target })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`SEO Metrics Checker: ${res.status}`);
  const body: unknown = await res.json();
  const found: FetchedMetrics = {
    trustFlow: findNumber(body, /^majesticTF$/) ?? undefined,
    citationFlow: findNumber(body, /^majesticCF$/) ?? undefined,
    domainAuthority: findNumber(body, /^mozDA$/) ?? undefined,
    spamScore: findNumber(body, /^spamScore$/) ?? undefined,
  };
  if (found.trustFlow === undefined && found.domainAuthority === undefined) {
    console.log(`metrics ${target}: unexpected SEO Metrics Checker answer`, JSON.stringify(body).slice(0, 300));
    throw new Error("SEO Metrics Checker gaf geen cijfers");
  }
  return found;
}

// Fetches everything it can for one site and stores it; a source that fails
// keeps its figures from the last time.
export async function refreshWebsiteMetrics(websiteId: string): Promise<{ ok: boolean; message: string }> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { domain: true, metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });
  if (!website) return { ok: false, message: "Website niet gevonden." };

  const [ahrefsKey, seoKey] = await Promise.all([getApiKey("ahrefs"), getApiKey("seometrics")]);
  const [ahrefs, seo, ip] = await Promise.allSettled([
    ahrefsKey ? fetchAhrefsMetrics(website.domain, ahrefsKey) : Promise.reject(new Error("geen Ahrefs-sleutel")),
    seoKey ? fetchSeoMetrics(website.domain, seoKey) : Promise.reject(new Error("geen SEO Metrics Checker-sleutel")),
    lookupIp(website.domain),
  ]);
  const got = (r: PromiseSettledResult<FetchedMetrics>) => (r.status === "fulfilled" ? r.value : {});
  const fresh: FetchedMetrics = { ...got(ahrefs), ...got(seo), ...got(ip) };
  const failed = [
    ahrefs.status === "rejected" ? "Ahrefs" : null,
    seo.status === "rejected" ? "SEO Metrics Checker" : null,
  ].filter(Boolean);
  console.log(
    `metrics ${website.domain}: Ahrefs ${ahrefs.status === "fulfilled" ? "ok" : `mislukt (${(ahrefs as PromiseRejectedResult).reason})`}, ` +
      `SEO Metrics ${seo.status === "fulfilled" ? "ok" : `mislukt (${(seo as PromiseRejectedResult).reason})`}, IP ${fresh.ipAddress ?? "onbekend"}`
  );
  if (ahrefs.status === "rejected" && seo.status === "rejected" && !fresh.ipAddress) {
    return { ok: false, message: "Ophalen mislukt: Ahrefs en SEO Metrics Checker gaven geen antwoord." };
  }

  const prev = website.metrics[0];
  await prisma.websiteMetric.create({
    data: {
      websiteId,
      source: "auto",
      domainRating: fresh.domainRating ?? prev?.domainRating ?? 0,
      organicTraffic: fresh.organicTraffic ?? prev?.organicTraffic ?? 0,
      referringDomains: fresh.referringDomains ?? prev?.referringDomains ?? 0,
      domainAuthority: fresh.domainAuthority ?? prev?.domainAuthority ?? 0,
      trustFlow: fresh.trustFlow ?? prev?.trustFlow ?? null,
      citationFlow: fresh.citationFlow ?? prev?.citationFlow ?? null,
      spamScore: fresh.spamScore ?? prev?.spamScore ?? null,
      ipAddress: fresh.ipAddress ?? prev?.ipAddress ?? null,
      behindCloudflare: fresh.behindCloudflare ?? prev?.behindCloudflare ?? false,
      aiCited: prev?.aiCited ?? null,
    },
  });
  return failed.length
    ? { ok: true, message: `Bijgewerkt, behalve ${failed.join(" en ")} (vorige cijfers bewaard).` }
    : { ok: true, message: "Cijfers bijgewerkt." };
}

// The four figures an admin or supplier can type in on the edit form.
export type ManualFigures = {
  domainRating: number;
  domainAuthority: number;
  organicTraffic: number;
  referringDomains: number;
};

type PreviousMetric = ManualFigures & {
  trustFlow: number | null;
  citationFlow: number | null;
  spamScore: number | null;
  ipAddress: string | null;
  behindCloudflare: boolean;
  aiCited: boolean | null;
};

// The row to store when the edit form is saved: the typed figures, with
// everything the form doesn't show (TF, CF, IP, ...) carried over from the
// latest row. Null when the typed figures didn't change, so saving the form
// for another field leaves the figures alone.
export function manualMetricRow(prev: PreviousMetric | null, figures: ManualFigures) {
  if (
    prev &&
    prev.domainRating === figures.domainRating &&
    prev.domainAuthority === figures.domainAuthority &&
    prev.organicTraffic === figures.organicTraffic &&
    prev.referringDomains === figures.referringDomains
  ) {
    return null;
  }
  return {
    ...figures,
    trustFlow: prev?.trustFlow ?? null,
    citationFlow: prev?.citationFlow ?? null,
    spamScore: prev?.spamScore ?? null,
    ipAddress: prev?.ipAddress ?? null,
    behindCloudflare: prev?.behindCloudflare ?? false,
    aiCited: prev?.aiCited ?? null,
    source: "manual",
  };
}

export async function saveManualMetrics(websiteId: string, figures: ManualFigures): Promise<void> {
  const prev = await prisma.websiteMetric.findFirst({ where: { websiteId }, orderBy: { fetchedAt: "desc" } });
  const row = manualMetricRow(prev, figures);
  if (row) await prisma.websiteMetric.create({ data: { websiteId, ...row } });
}

// The monthly refresh, a few sites per hourly run: every live or submitted
// site whose last automatic fetch is older than REFRESH_AFTER_DAYS.
export async function refreshDueWebsiteMetrics(now = new Date()): Promise<number> {
  const [ahrefsKey, seoKey] = await Promise.all([getApiKey("ahrefs"), getApiKey("seometrics")]);
  if (!ahrefsKey && !seoKey) return 0;
  const cutoff = new Date(now.getTime() - REFRESH_AFTER_DAYS * DAY_MS);
  const due = await prisma.website.findMany({
    where: {
      status: { in: ["ACTIVE", "SUBMITTED"] },
      NOT: { metrics: { some: { source: "auto", fetchedAt: { gte: cutoff } } } },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: PER_RUN,
  });
  for (const { id } of due) await refreshWebsiteMetrics(id);
  return due.length;
}

// When the monthly run will next pick up a site fetched at `fetchedAt`.
export function nextRefreshDate(fetchedAt: Date): Date {
  return new Date(fetchedAt.getTime() + REFRESH_AFTER_DAYS * DAY_MS);
}

// The overview for Instellingen → Koppelingen: per site when its figures
// were last fetched automatically and when the monthly run is due again.
export type SiteRefresh = { id: string; domain: string; lastRun: Date | null; nextRun: Date };

export async function metricsOverview(now = new Date()): Promise<SiteRefresh[]> {
  const sites = await prisma.website.findMany({
    where: { status: { in: ["ACTIVE", "SUBMITTED"] } },
    select: {
      id: true,
      domain: true,
      metrics: { where: { source: "auto" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { fetchedAt: true } },
    },
    orderBy: { domain: "asc" },
  });
  return sites.map((s) => {
    const lastRun = s.metrics[0]?.fetchedAt ?? null;
    return { id: s.id, domain: s.domain, lastRun, nextRun: lastRun ? nextRefreshDate(lastRun) : now };
  });
}

// "Alle websites nu vernieuwen": every live or submitted site, one after the
// other (in the background — it can take a while).
export async function refreshAllWebsiteMetrics(): Promise<number> {
  const sites = await prisma.website.findMany({
    where: { status: { in: ["ACTIVE", "SUBMITTED"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  void (async () => {
    for (const { id } of sites) await refreshWebsiteMetrics(id).catch((err) => console.error("metrics:", err));
    console.log(`metrics: alle ${sites.length} websites handmatig bijgewerkt`);
  })();
  return sites.length;
}
