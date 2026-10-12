import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { compareVersions, domainFromUserAgent, latestVersion, versionForSite, versionOf } from "./pluginReleases";

const DIR = path.join(process.cwd(), "wordpress-plugin");
const MAIN = path.join(DIR, "nugevonden-wp-sync.php");
const releases = fs
  .readdirSync(path.join(DIR, "releases"))
  .filter((f) => f.endsWith(".php"))
  .map((f) => path.join(DIR, "releases", f));
const hasPhp = spawnSync("php", ["-v"]).status === 0;

describe("which plugin version a site gets", () => {
  it("gives test sites the newest and the others the released one", () => {
    expect(versionForSite({ pluginTestSite: true }, "1.15.0", "1.15.1")).toBe("1.15.1");
    expect(versionForSite({ pluginTestSite: false }, "1.15.0", "1.15.1")).toBe("1.15.0");
    expect(versionForSite(null, "1.15.0", "1.15.1")).toBe("1.15.0");
    expect(versionForSite(null, null, "1.15.1")).toBe("1.15.1");
  });

  it("compares versions as numbers", () => {
    expect(compareVersions("1.15.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.15.1", "1.15.1")).toBe(0);
  });

  it("recognises a site from WordPress' User-Agent", () => {
    expect(domainFromUserAgent("WordPress/7.1.3; https://a2f.nl")).toBe("a2f.nl");
    expect(domainFromUserAgent("WordPress/6.7; https://www.Digikeur.nl")).toBe("digikeur.nl");
    expect(domainFromUserAgent("curl/8")).toBeNull();
  });
});

// Before a plugin version can reach any site: kept, and free of anything
// that would stop WordPress from loading it.
describe("the plugin files", () => {
  it("keeps every version, the current one identical", () => {
    const kept = path.join(DIR, "releases", `nugevonden-wp-sync-${latestVersion()}.php`);
    expect(fs.existsSync(kept), `bewaar ${latestVersion()} in wordpress-plugin/releases/`).toBe(true);
    expect(fs.readFileSync(kept, "utf8")).toBe(fs.readFileSync(MAIN, "utf8"));
    for (const file of releases) {
      expect(path.basename(file)).toBe(`nugevonden-wp-sync-${versionOf(fs.readFileSync(file, "utf8"))}.php`);
    }
  });

  it.skipIf(!hasPhp)("has no PHP syntax errors", () => {
    for (const file of [MAIN, ...releases]) {
      const r = spawnSync("php", ["-l", file], { encoding: "utf8" });
      expect(r.status, `${path.basename(file)}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  });

  it("uses nothing newer than PHP 7.4 (what older hosting still runs)", () => {
    const code = fs
      .readFileSync(MAIN, "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    const php8 = [
      [/(?<![\w$>:])match\s*\(/, "match()"],
      [/\?->/, "?->"],
      [/catch\s*\(\s*\\?[A-Za-z_\\]+\s*\)/, "catch zonder variabele"],
      [/^\s*enum\s+\w+/m, "enum"],
      [/\breadonly\s+(public|private|protected|\w+\s+\$)/, "readonly"],
      [/\)\s*:\s*(never|mixed|static)\b/, "never/mixed/static als return-type"],
    ] as const;
    for (const [pattern, name] of php8) expect(pattern.test(code), `PHP 8: ${name}`).toBe(false);
  });
});
