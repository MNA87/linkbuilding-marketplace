// The one look every outgoing email has: the name above a white card on a
// light grey page, and under the card the links and the sender's address.
// Only the text inside the card differs per mail (Admin → E-mails).
//
// Email clients ignore most <style> blocks, so the plain HTML of a template
// gets its styling inline here. Three classes give a template more than
// text: class="knop" on a link makes a green button, class="kader" a soft
// green box, class="klein" small grey text.

import type { SiteSettings } from "@prisma/client";

const GREEN = "#0d9488";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export type EmailSender = {
  name: string;
  address: string;
  postcode: string;
  city: string;
  email: string;
};

// Admin → Instellingen → Bedrijfsgegevens.
export function emailSenderFrom(settings: SiteSettings | null): EmailSender {
  return {
    name: settings?.sellerName ?? "",
    address: settings?.sellerAddress ?? "",
    postcode: settings?.sellerPostcode ?? "",
    city: settings?.sellerCity ?? "",
    email: settings?.sellerEmail ?? "",
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hasClass = (attrs: string, name: string) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`).test(attrs);
// A tag that already has its own style is left as the template wrote it.
const addStyle = (tag: string, attrs: string, style: string) =>
  /\sstyle=/.test(attrs) ? `<${tag}${attrs}>` : `<${tag}${attrs} style="${style}">`;

export function styleEmailBody(html: string): string {
  return (
    html
      // A button: a table cell with the colour, since Outlook ignores
      // padding and rounded corners on a link.
      .replace(/<a(\s[^>]*)>([\s\S]*?)<\/a>/g, (match, attrs: string, text: string) => {
        if (!hasClass(attrs, "knop")) return match;
        const link = `<a${attrs} style="display:inline-block;padding:13px 26px;font:600 15px ${FONT};color:#ffffff;text-decoration:none;border-radius:8px">${text}</a>`;
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:${GREEN}">${link}</td></tr></table>`;
      })
      .replace(/<a(\s[^>]*)?>/g, (_m, attrs = "") => addStyle("a", attrs, `color:${GREEN};word-break:break-word`))
      .replace(/<h1(\s[^>]*)?>/g, (_m, attrs = "") => addStyle("h1", attrs, `margin:0 0 18px;font:400 26px/1.25 ${SERIF};color:#111827`))
      .replace(/<p(\s[^>]*)?>/g, (_m, attrs = "") =>
        addStyle(
          "p",
          attrs,
          hasClass(attrs, "klein")
            ? `margin:0 0 12px;font:13px/1.6 ${FONT};color:#6b7280`
            : `margin:0 0 14px;font:15px/1.65 ${FONT};color:#374151`
        )
      )
      .replace(/<div(\s[^>]*)?>/g, (m, attrs = "") =>
        hasClass(attrs, "kader")
          ? addStyle("div", attrs, `margin:24px 0 4px;padding:18px 20px;background:#f0faf9;border-radius:12px;font:14px/1.7 ${FONT};color:#374151`)
          : m
      )
      .replace(/<ul(\s[^>]*)?>/g, (_m, attrs = "") => addStyle("ul", attrs, `margin:0 0 14px;padding-left:20px;font:15px/1.65 ${FONT};color:#374151`))
      .replace(/<li(\s[^>]*)?>/g, (_m, attrs = "") => addStyle("li", attrs, "margin:0 0 4px"))
  );
}

export function emailLayout({
  body,
  subject,
  to,
  sender,
  appUrl,
}: {
  body: string;
  subject: string;
  to: string;
  sender: EmailSender;
  appUrl: string;
}): string {
  const brand = sender.name || "Nugevonden";
  const link = (href: string, text: string) =>
    `<a href="${href}" style="color:#374151;font-weight:600;text-decoration:none">${text}</a>`;
  const links = [
    sender.email && link(`mailto:${escapeHtml(sender.email)}`, "Contact"),
    link(`${appUrl}/privacy`, "Privacy"),
    link(`${appUrl}/voorwaarden`, "Voorwaarden"),
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  const place = [sender.postcode, sender.city].filter(Boolean).join(" ");
  const address = [brand, sender.address, place].filter(Boolean).map(escapeHtml).join(" · ");

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title>
<style>@media (max-width:480px){.kaart{padding:28px 22px 18px!important}}</style></head>
<body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="padding:0 8px 18px;font:400 24px ${SERIF};color:#111827">${escapeHtml(brand)}</td></tr>
    <tr><td class="kaart" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:36px 40px 26px">
${styleEmailBody(body)}
    </td></tr>
    <tr><td style="padding:24px 24px 32px;text-align:center;font:13px/1.6 ${FONT};color:#6b7280">
      ${links}
      <div style="margin-top:10px">Dit bericht is verstuurd naar <span style="color:#374151">${escapeHtml(to)}</span>.</div>
      <div style="margin-top:10px;color:#9ca3af">${address}</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
