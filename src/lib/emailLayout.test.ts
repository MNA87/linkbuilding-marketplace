import { describe, expect, it } from "vitest";
import { emailLayout, styleEmailBody } from "./emailLayout";

const sender = { name: "Nugevonden", address: "Straat 1", postcode: "1234 AB", city: "Amsterdam", email: "info@nugevonden.nl" };

describe("styleEmailBody", () => {
  it("turns a link with class knop into a green button", () => {
    const html = styleEmailBody('<a class="knop" href="https://x.nl">Activeren</a>');
    expect(html).toContain('<td style="border-radius:8px;background:#0d9488">');
    expect(html).toContain('href="https://x.nl"');
    expect(html).toContain("color:#ffffff");
    expect(html.match(/style=/g)).toHaveLength(3);
  });

  it("styles plain text, small text and the box", () => {
    const html = styleEmailBody('<p>Hoi</p><p class="klein">Klein</p><div class="kader">Stap</div><div>los</div>');
    expect(html).toContain('<p style="margin:0 0 14px;font:15px');
    expect(html).toContain('<p class="klein" style="margin:0 0 12px;font:13px');
    expect(html).toContain('<div class="kader" style="margin:24px 0 4px');
    expect(html).toContain("<div>los</div>");
  });

  it("leaves a tag with its own style alone", () => {
    expect(styleEmailBody('<p style="color:red">x</p>')).toBe('<p style="color:red">x</p>');
  });
});

describe("emailLayout", () => {
  it("puts the text in the card with the links and address below", () => {
    const html = emailLayout({ body: "<p>Hallo</p>", subject: "Welkom", to: "jan@x.nl", sender, appUrl: "https://mijn.nl" });
    expect(html).toContain("Hallo");
    expect(html).toContain('href="mailto:info@nugevonden.nl"');
    expect(html).toContain('href="https://mijn.nl/privacy"');
    expect(html).toContain('href="https://mijn.nl/voorwaarden"');
    expect(html).toContain("Dit bericht is verstuurd naar <span");
    expect(html).toContain("Nugevonden · Straat 1 · 1234 AB Amsterdam");
  });

  it("leaves out Contact and an empty address when they aren't filled in", () => {
    const empty = { name: "", address: "", postcode: "", city: "", email: "" };
    const html = emailLayout({ body: "", subject: "x", to: "a@b.nl", sender: empty, appUrl: "https://mijn.nl" });
    expect(html).not.toContain("Contact");
    expect(html).toContain(">Nugevonden</div>");
  });

  it("escapes the address it shows", () => {
    const html = emailLayout({ body: "", subject: "x", to: "<a@b.nl>", sender, appUrl: "https://mijn.nl" });
    expect(html).toContain("&lt;a@b.nl&gt;");
  });
});
