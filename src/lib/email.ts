import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY ontbreekt in de omgevingsvariabelen.");
  }
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FROM = process.env.EMAIL_FROM ?? "Nugevonden <no-reply@nugevonden.nl>";

// Every send is wrapped so a misconfigured/failing mail provider never
// crashes the request that triggered it (checkout, password reset, ...) —
// we log and move on rather than let a 500 block an already-paid order.
async function sendSafely(params: { to: string; subject: string; html: string }) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({ from: FROM, ...params });
    if (error) {
      console.error(`Kon e-mail "${params.subject}" niet versturen naar ${params.to}`, error);
    }
  } catch (err) {
    console.error(`Kon e-mail "${params.subject}" niet versturen naar ${params.to}`, err);
  }
}

export type EmailTemplateKey =
  | "verification"
  | "password_reset"
  | "order_confirmation"
  | "new_order_notification"
  | "order_published"
  | "placement_expiring"
  | "content_reminder"
  | "email_change"
  | "email_changed";

// The fixed set of outgoing emails an admin can override the text of from
// Admin -> E-mails, and the {{placeholder}} variables each one fills in.
// No admin override in the database means the default here is what goes
// out — see renderTemplate below.
export const EMAIL_TEMPLATES: Record<
  EmailTemplateKey,
  { label: string; description: string; placeholders: string[]; subject: string; bodyHtml: string }
> = {
  verification: {
    label: "E-mailadres bevestigen",
    description: "Verstuurd bij registratie, om het e-mailadres te bevestigen.",
    placeholders: ["verifyUrl"],
    subject: "Bevestig je e-mailadres — Nugevonden",
    bodyHtml: `<p>Bedankt voor je registratie bij Nugevonden.</p>
      <p><a href="{{verifyUrl}}">Klik hier om je e-mailadres te bevestigen</a>. Deze link is 24 uur geldig.</p>
      <p>Je kunt pas inloggen nadat je je e-mailadres hebt bevestigd.</p>
      <p>Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>`,
  },
  password_reset: {
    label: "Wachtwoord resetten",
    description: "Verstuurd als iemand een nieuw wachtwoord aanvraagt.",
    placeholders: ["resetUrl"],
    subject: "Wachtwoord resetten — Nugevonden",
    bodyHtml: `<p>Je hebt een wachtwoordreset aangevraagd.</p>
      <p><a href="{{resetUrl}}">Klik hier om een nieuw wachtwoord in te stellen</a>. Deze link is 15 minuten geldig.</p>
      <p>Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>`,
  },
  order_confirmation: {
    label: "Bevestiging van bestelling",
    description: "Verstuurd naar de klant zodra de betaling gelukt is.",
    placeholders: ["domain", "amount", "orderUrl", "contentNoteHtml"],
    subject: "Bevestiging van je bestelling — Nugevonden",
    bodyHtml: `<p>Bedankt voor je bestelling voor <strong>{{domain}}</strong>.</p>
      <p>Bedrag: &euro;{{amount}} (incl. BTW)</p>
      {{contentNoteHtml}}
      <p><a href="{{orderUrl}}">Bekijk je order</a>.</p>`,
  },
  new_order_notification: {
    label: "Nieuwe order (publisher)",
    description: "Verstuurd naar een publisher zodra er een betaalde order voor hun site binnenkomt.",
    placeholders: ["domain", "amount", "ordersUrl"],
    subject: "Nieuwe order ontvangen — Nugevonden",
    bodyHtml: `<p>Je hebt een nieuwe betaalde order ontvangen voor <strong>{{domain}}</strong> (&euro;{{amount}}).</p>
      <p><a href="{{ordersUrl}}">Bekijk je orders</a>.</p>`,
  },
  order_published: {
    label: "Plaatsing live",
    description: "Verstuurd naar de klant zodra (alle items van) de order live staat.",
    placeholders: ["liveLinksHtml", "orderUrl"],
    subject: "Je plaatsing staat live — Nugevonden",
    bodyHtml: `<p>Goed nieuws — je bestelling staat live:</p>
      <ul>{{liveLinksHtml}}</ul>
      <p><a href="{{orderUrl}}">Bekijk je order</a>.</p>`,
  },
  placement_expiring: {
    label: "Plaatsing verloopt binnenkort",
    description: "Verstuurd naar de klant een maand voordat de periode van een plaatsing afloopt.",
    placeholders: ["domain", "liveUrl", "expiresOn", "renewUrl"],
    subject: "Je plaatsing op {{domain}} verloopt op {{expiresOn}} — Nugevonden",
    bodyHtml: `<p>De periode van je plaatsing op <strong>{{domain}}</strong> loopt af op <strong>{{expiresOn}}</strong>:</p>
      <p><a href="{{liveUrl}}">{{liveUrl}}</a></p>
      <p>Verleng je niet, dan gaat de plaatsing na die datum offline.</p>
      <p><a href="{{renewUrl}}">Verleng je plaatsing</a>.</p>`,
  },
  content_reminder: {
    label: "Herinnering: inhoud aanleveren",
    description:
      "Verstuurd naar de klant 3, 7 en 30 dagen na betaling, zolang een betaalde link nog niet is ingevuld.",
    placeholders: ["domains", "orderNumber", "fillUrl"],
    subject: "Vergeet je niet je inhoud aan te leveren? Order #{{orderNumber}} — Nugevonden",
    bodyHtml: `<p>Je hebt order #{{orderNumber}} betaald, maar voor <strong>{{domains}}</strong> hebben we je inhoud nog niet ontvangen.</p>
      <p>Zodra je het invult, gaan we ermee aan de slag.</p>
      <p><a href="{{fillUrl}}">Nu invullen</a>.</p>`,
  },
  email_change: {
    label: "Nieuw e-mailadres bevestigen",
    description: "Verstuurd naar het nieuwe adres als een klant zijn e-mailadres wijzigt.",
    placeholders: ["newEmail", "confirmUrl"],
    subject: "Bevestig je nieuwe e-mailadres — Nugevonden",
    bodyHtml: `<p>Je wilt voortaan inloggen met <strong>{{newEmail}}</strong>.</p>
      <p><a href="{{confirmUrl}}">Klik hier om dit e-mailadres te bevestigen</a>. Deze link is 24 uur geldig.</p>
      <p>Tot je bevestigt, log je in met je huidige e-mailadres. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>`,
  },
  email_changed: {
    label: "E-mailadres gewijzigd",
    description: "Verstuurd naar het oude adres zodra een nieuw e-mailadres is bevestigd.",
    placeholders: ["newEmail"],
    subject: "Je e-mailadres is gewijzigd — Nugevonden",
    bodyHtml: `<p>Het e-mailadres van je Nugevonden-account is gewijzigd naar <strong>{{newEmail}}</strong>. Daarmee log je voortaan in.</p>
      <p>Heb je dit niet zelf gedaan? Neem dan direct contact met ons op.</p>`,
  },
};

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

async function renderTemplate(key: EmailTemplateKey, vars: Record<string, string>) {
  const override = await prisma.emailTemplate.findUnique({ where: { key } });
  const base = override ?? EMAIL_TEMPLATES[key];
  return { subject: substitute(base.subject, vars), html: substitute(base.bodyHtml, vars) };
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const { subject, html } = await renderTemplate("verification", { verifyUrl });
  await sendSafely({ to, subject, html });
}

export async function sendEmailChangeEmail(to: string, confirmUrl: string) {
  const { subject, html } = await renderTemplate("email_change", { newEmail: escapeHtml(to), confirmUrl });
  await sendSafely({ to, subject, html });
}

export async function sendEmailChangedEmail(to: string, newEmail: string) {
  const { subject, html } = await renderTemplate("email_changed", { newEmail: escapeHtml(newEmail) });
  await sendSafely({ to, subject, html });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { subject, html } = await renderTemplate("password_reset", { resetUrl });
  await sendSafely({ to, subject, html });
}

// toFill: the sites still waiting for the customer's content (paid before
// it was filled in) — named in the mail so it isn't forgotten.
export async function sendOrderConfirmationEmail(
  to: string,
  orderId: string,
  domain: string,
  amount: string,
  toFill: string[] = []
) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = await renderTemplate("order_confirmation", {
    domain,
    amount,
    orderUrl: `${appUrl}/dashboard/orders/${orderId}`,
    contentNoteHtml: toFill.length
      ? `<p>Nog aan te leveren: <strong>${escapeHtml(toFill.join(", "))}</strong>. Vul het in via je order, dan gaan we ermee aan de slag.</p>`
      : "",
  });
  await sendSafely({ to, subject, html });
}

export async function sendOrderPublishedEmail(
  to: string,
  orderId: string,
  liveLinks: { domain: string; liveUrl: string }[]
) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const liveLinksHtml = liveLinks
    .map((l) => `<li><strong>${l.domain}</strong>: <a href="${l.liveUrl}">${l.liveUrl}</a></li>`)
    .join("");
  const { subject, html } = await renderTemplate("order_published", {
    liveLinksHtml,
    orderUrl: `${appUrl}/dashboard/orders/${orderId}`,
  });
  await sendSafely({ to, subject, html });
}

export async function sendNewOrderNotificationEmail(to: string, domain: string, amount: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = await renderTemplate("new_order_notification", {
    domain,
    amount,
    ordersUrl: `${appUrl}/supplier/orders`,
  });
  await sendSafely({ to, subject, html });
}

export async function sendContentReminderEmail(to: string, orderNumber: number, domains: string[], fillPath: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = await renderTemplate("content_reminder", {
    domains: escapeHtml(domains.join(", ")),
    orderNumber: String(orderNumber),
    fillUrl: `${appUrl}${fillPath}`,
  });
  await sendSafely({ to, subject, html });
}

export async function sendPlacementExpiringEmail(
  to: string,
  domain: string,
  liveUrl: string,
  expiresOn: string,
  orderItemId: string
) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = await renderTemplate("placement_expiring", {
    domain,
    liveUrl,
    expiresOn,
    renewUrl: `${appUrl}/dashboard/orders/link/${orderItemId}`,
  });
  await sendSafely({ to, subject, html });
}

// A warning about the platform itself (e.g. no recent database backup) to an
// admin. Not an editable template: it's for the operator, not for customers.
export async function sendSystemAlertEmail(to: string, subject: string, message: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendSafely({
    to,
    subject: `${subject} — Nugevonden`,
    html: `<p>${escapeHtml(message)}</p>
      <p><a href="${appUrl}/admin/settings?tab=systeem">Bekijk Instellingen → Systeem</a>.</p>`,
  });
}

// To the admins: a customer sent in the content for a link they had already
// paid for, so it can be reviewed or placed now.
export async function sendContentReceivedEmail(to: string, orderNumber: number, domain: string, orderItemId: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendSafely({
    to,
    subject: `Inhoud ontvangen voor order #${orderNumber} (${domain}) — Nugevonden`,
    html: `<p>De klant heeft de inhoud aangeleverd voor <strong>${escapeHtml(domain)}</strong> (order #${orderNumber}).</p>
      <p><a href="${appUrl}/admin/orders/${orderItemId}">Bekijk de order</a>.</p>`,
  });
}
