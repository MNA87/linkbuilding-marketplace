import fs from "node:fs";
import path from "node:path";

// The WordPress plugin, so a new version can never break every site at once:
// - every version ever shipped is kept in wordpress-plugin/releases/
//   (a test checks the current one is there);
// - a test site (Website.pluginTestSite, like a2f.nl) gets the newest version
//   as soon as it's online;
// - every other site gets the released version (SiteSettings.pluginReleasedVersion),
//   which only changes when the admin releases a tested version in
//   Instellingen → Systeem.
// The plugin installs whatever it's handed by itself, so this is the one
// place that decides.

const PLUGIN_DIR = path.join(process.cwd(), "wordpress-plugin");
const RELEASES_DIR = path.join(PLUGIN_DIR, "releases");
const VERSION = /^\d+\.\d+\.\d+$/;

export function versionOf(source: string): string {
  return source.match(/Version:\s*([\d.]+)/)?.[1] ?? "0.0.0";
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export function latestVersion(): string {
  return versionOf(fs.readFileSync(path.join(PLUGIN_DIR, "nugevonden-wp-sync.php"), "utf8"));
}

// The plugin file of one version, or null when it isn't kept.
export function releaseSource(version: string): Buffer | null {
  if (!VERSION.test(version)) return null;
  const file = path.join(RELEASES_DIR, `nugevonden-wp-sync-${version}.php`);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

// What a site is handed: the newest on a test site; elsewhere the released
// version (the newest while none is set, as before this existed).
export function versionForSite(
  site: { pluginTestSite: boolean } | null,
  released: string | null,
  latest: string
): string {
  if (site?.pluginTestSite || !released) return latest;
  return compareVersions(released, latest) > 0 ? latest : released;
}

// "WordPress/6.7; https://www.a2f.nl" → "a2f.nl": how a plugin before 1.15.1,
// which doesn't send its secret when asking for updates, is recognised.
export function domainFromUserAgent(ua: string | null): string | null {
  const m = /;\s*https?:\/\/([^/\s;]+)/i.exec(ua ?? "");
  return m ? m[1].toLowerCase().replace(/^www\./, "") : null;
}

// "1.15.1" from the plugin's X-Nugevonden-Version header (since 1.15.1).
export function reportedVersion(req: Request): string | null {
  const v = req.headers.get("x-nugevonden-version")?.trim() ?? "";
  return VERSION.test(v) ? v : null;
}
