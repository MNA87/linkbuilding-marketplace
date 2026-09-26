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
  | "placement_expiring";

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
    placeholders: ["domain", "amount", "orderUrl"],
    subject: "Bevestiging van je bestelling — Nugevonden",
    bodyHtml: `<p>Bedankt voor je bestelling voor <strong>{{domain}}</strong>.</p>
      <p>Bedrag: &euro;{{amount}} (incl. BTW)</p>
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

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { subject, html } = await renderTemplate("password_reset", { resetUrl });
  await sendSafely({ to, subject, html });
}

export async function sendOrderConfirmationEmail(to: string, orderId: string, domain: string, amount: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = await renderTemplate("order_confirmation", {
    domain,
    amount,
    orderUrl: `${appUrl}/dashboard/orders/${orderId}`,
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
