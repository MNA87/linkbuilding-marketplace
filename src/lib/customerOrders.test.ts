import { describe, expect, it } from "vitest";
import { articleExcerpt, inTab, orderStatus, linkStatus, nlDateTime, matchesSearch, parseOrderSort, parseTab, shortUrl, sortLinks, type LinkStatusInput } from "./customerOrders";

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
  const row = (id: string, orderNumber: number, domain = "a.nl", stage: "live" | "behandeling" | "verloopt" = "live") => ({
    id,
    orderNumber,
    domain,
    stage,
  });
  const rows = [
    row("b", 20, "zon.nl", "behandeling"),
    row("c", 30, "blog.nl"),
    row("a", 20, "a2f.nl", "verloopt"),
    row("d", 10, "blog.nl", "behandeling"),
  ];

  it("sorts by order number (newest or oldest first), by website or by status", () => {
    expect(sortLinks(rows).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
    expect(sortLinks(rows, "oud").map((r) => r.id)).toEqual(["d", "b", "a", "c"]);
    expect(sortLinks(rows, "website").map((r) => r.id)).toEqual(["a", "c", "d", "b"]);
    expect(sortLinks(rows, "status").map((r) => r.id)).toEqual(["a", "b", "d", "c"]);
    expect(parseOrderSort("website")).toBe("website");
    expect(parseOrderSort("x")).toBe("nieuw");
  });
});

describe("matchesSearch", () => {
  const row = { domain: "a2f.nl", orderNumber: 57, anchors: ["Duurzame Tuinmeubelen"] };

  it("finds a link by website, order number or anchor, ignoring case", () => {
    expect(matchesSearch(row, "A2F")).toBe(true);
    expect(matchesSearch(row, "57")).toBe(true);
    expect(matchesSearch(row, "#57")).toBe(true);
    expect(matchesSearch(row, "5")).toBe(false);
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

describe("orderStatus", () => {
  it("sums up the links of one order", () => {
    expect(orderStatus(["live"])).toEqual({ stage: "live", label: "Live" });
    expect(orderStatus(["live", "live"])).toEqual({ stage: "live", label: "Live" });
    expect(orderStatus(["live", "ingepland", "live"])).toEqual({ stage: "live", label: "Deels live · 2 van 3" });
    expect(orderStatus(["live", "verloopt"]).label).toBe("Verloopt binnenkort");
    expect(orderStatus(["behandeling", "ingepland"]).label).toBe("In behandeling");
    expect(orderStatus(["live", "verlopen"]).label).toBe("Live");
  });
});
