import { describe, expect, it } from "vitest";
import { inTab, linkStatus, parseTab, shortUrl, sortLinks, type LinkStatusInput } from "./customerOrders";

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
    expect(blog).toMatchObject({ stage: "live", detail: "Blijft online" });
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
  it("puts the newest order first", () => {
    const row = (id: string, ordered: string) => ({ id, orderedAt: new Date(ordered) });
    const sorted = sortLinks([row("b", "2026-01-01"), row("c", "2026-09-01"), row("a", "2026-01-01"), row("d", "2025-05-01")]);
    expect(sorted.map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("shortUrl", () => {
  it("drops protocol, www and a trailing slash", () => {
    expect(shortUrl("https://www.site.nl/pagina/")).toBe("site.nl/pagina");
    expect(shortUrl("http://site.nl")).toBe("site.nl");
  });
});
