import { describe, expect, it } from "vitest";
import { articleExcerpt, inTab, linkStatus, nlDateTime, matchesSearch, parseOrderSort, parseTab, shortUrl, sortLinks, type LinkStatusInput } from "./customerOrders";

const now = new Date("2026-09-25T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const base: LinkStatusInput = { orderStatus: "PAID", periodic: true, publishAt: null, writeForMe: false, articleBody: "<p>x</p>", placement: null };

describe("linkStatus", () => {
  it("is being handled until it's placed", () => {
    expect(linkStatus(base, now)).toMatchObject({ stage: "behandeling", detail: "Wordt geplaatst" });
    expect(linkStatus({ ...base, writeForMe: true, articleBody: null }, now)).toMatchObject({ detail: "Wordt geschreven" });
    expect(linkStatus({ ...base, placement: { status: "draft", expiresAt: null, expiredAt: null } }, now).stage).toBe("behandeling");
  });

  it("is planned when its day is still ahead", () => {
    const s = linkStatus({ ...base, publishAt: new Date(now.getTime() + 5 * day) }, now);
    expect(s.stage).toBe("ingepland");
    expect(s.detail).toBe("Online op 30-9-2026");
    expect(linkStatus({ ...base, publishAt: new Date(now.getTime() - day) }, now).stage).toBe("behandeling");
  });

  it("is live, and about to expire within the reminder window", () => {
    const live = (days: number) =>
      linkStatus({ ...base, placement: { status: "published", expiresAt: new Date(now.getTime() + days * day), expiredAt: null } }, now);
    expect(live(200).stage).toBe("live");
    expect(live(30).stage).toBe("verloopt");
    expect(live(10)).toMatchObject({ label: "Verloopt binnenkort", detail: "Loopt tot 5-10-2026" });
    expect(linkStatus({ ...base, placement: { status: "published", expiresAt: null, expiredAt: null } }, now).stage).toBe("live");
  });

  it("keeps a blog article live for good, whatever end date it once got", () => {
    const blog = linkStatus(
      { ...base, periodic: false, placement: { status: "published", expiresAt: new Date(now.getTime() + 5 * day), expiredAt: null } },
      now
    );
    expect(blog).toMatchObject({ stage: "live", detail: "Online" });
    const since = linkStatus(
      { ...base, periodic: false, placement: { status: "published", publishedAt: new Date("2025-10-09T10:00:00Z"), expiresAt: null, expiredAt: null } },
      now
    );
    expect(since.detail).toBe("Online sinds 9-10-2025");
  });

  it("is expired once taken offline", () => {
    const s = linkStatus(
      { ...base, placement: { status: "expired", expiresAt: new Date("2026-09-01T00:00:00Z"), expiredAt: new Date("2026-09-02T08:00:00Z") } },
      now
    );
    expect(s).toMatchObject({ stage: "verlopen", detail: "Verlopen op 2-9-2026" });
  });

  it("is cancelled whatever the placement says", () => {
    expect(linkStatus({ ...base, orderStatus: "CANCELLED" }, now).label).toBe("Geannuleerd");
    expect(linkStatus({ ...base, orderStatus: "REFUND_REQUESTED" }, now).label).toBe("Annulering aangevraagd");
  });
});

describe("tabs", () => {
  it("falls back to all and shows expiring links under Live too", () => {
    expect(parseTab("verloopt")).toBe("verloopt");
    expect(parseTab("onzin")).toBe("alle");
    expect(parseTab(undefined)).toBe("alle");
    expect(inTab("verloopt", "live")).toBe(true);
    expect(inTab("live", "verloopt")).toBe(false);
    expect(inTab("geannuleerd", "alle")).toBe(true);
  });
});

describe("sortLinks", () => {
  const row = (id: string, ordered: string) => ({ id, orderedAt: new Date(ordered) });
  const rows = [row("b", "2026-01-01"), row("c", "2026-09-01"), row("a", "2026-01-01"), row("d", "2025-05-01")];

  it("puts the newest order first by default, or the oldest", () => {
    expect(sortLinks(rows).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
    expect(sortLinks(rows, "oud").map((r) => r.id)).toEqual(["d", "a", "b", "c"]);
    expect(parseOrderSort("oud")).toBe("oud");
    expect(parseOrderSort("x")).toBe("nieuw");
  });
});

describe("matchesSearch", () => {
  it("finds a link by website or anchor, ignoring case", () => {
    const row = { domain: "a2f.nl", anchors: ["Duurzame Tuinmeubelen"] };
    expect(matchesSearch(row, "A2F")).toBe(true);
    expect(matchesSearch(row, "tuinmeubel")).toBe(true);
    expect(matchesSearch(row, "fiets")).toBe(false);
    expect(matchesSearch(row, "  ")).toBe(true);
  });
});

describe("shortUrl", () => {
  it("drops protocol, www and a trailing slash", () => {
    expect(shortUrl("https://www.site.nl/pagina/")).toBe("site.nl/pagina");
    expect(shortUrl("http://site.nl")).toBe("site.nl");
  });
});

describe("article preview", () => {
  it("turns the article into a short plain-text opening", () => {
    expect(articleExcerpt("<h2>Kop</h2><p>Een <a href='x'>link</a> &amp; meer.</p>")).toBe("Kop Een link & meer.");
    expect(articleExcerpt("<p>" + "woord ".repeat(100) + "</p>", 30)).toBe("woord woord woord woord woord…");
  });

  it("shows date and Dutch time", () => {
    expect(nlDateTime(new Date("2026-09-30T06:00:00Z"))).toBe("30-9-2026 om 08:00");
  });
});
