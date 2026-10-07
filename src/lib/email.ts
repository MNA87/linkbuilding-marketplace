import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { emailLayout, emailSenderFrom } from "@/lib/emailLayout";

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
    const html = await wrapInLayout(params);
    const { error } = await resend.emails.send({ from: FROM, ...params, html });
    if (error) {
      console.error(`Kon e-mail "${params.subject}" niet versturen naar ${params.to}`, error);
    }
  } catch (err) {
    console.error(`Kon e-mail "${params.subject}" niet versturen naar ${params.to}`, err);
  }
}

// The card with the name above it and the sender's address below it
// (src/lib/emailLayout.ts); the address comes from Admin → Instellingen →
// Bedrijfsgegevens.
async function wrapInLayout({ to, subject, html }: { to: string; subject: string; html: string }) {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } }).catch(() => null);
  return emailLayout({
    body: html,
    subject,
    to,
    appUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    sender: emailSenderFrom(settings),
  });
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
  | "email_changed"
  | "password_changed"
  | "admin_login"
  | "account_locked";

// The fixed set of outgoing emails an admin can override the text of from
// Admin -> E-mails, and the {{placeholder}} variables each one fills in.
// No admin override in the database means the default here is what goes
// out — see renderTemplate below.
export const EMAIL_TEMPLATES: Record<
  EmailTemplateKey,
  { label: string; description: string; placeholders: string[]; subject: string; bodyHtml: string }
> = {
  verification: {
    label: "Welkom: e-mailadres bevestigen",
    description: "Verstuurd bij registratie, om het e-mailadres te bevestigen.",
    placeholders: ["firstName", "verifyUrl"],
    subject: "Welkom bij Nugevonden – bevestig je e-mailadres",
    bodyHtml: `<h1>Welkom bij Nugevonden!</h1>
<p>Hoi {{firstName}},</p>
<p>Leuk dat je er bent! Je bent nog één stap verwijderd van links op Nederlandse websites. Bevestig je e-mailadres om je account te activeren.</p>
<a class="knop" href="{{verifyUrl}}">Account activeren</a>
<p class="klein">Werkt de knop niet? Kopieer dan deze link in je browser:<br><a href="{{verifyUrl}}">{{verifyUrl}}</a></p>
<p class="klein">De link is 24 uur geldig. Heb je geen account aangemaakt? Dan kun je deze e-mail negeren.</p>
<div class="kader"><strong>Zo werkt het</strong><br>
1&nbsp; Kies een website uit het aanbod<br>
2&nbsp; Lever je tekst aan, of laat ons schrijven<br>
3&nbsp; Wij plaatsen de link en je ziet hem live</div>`,
  },
  password_reset: {
    label: "Wachtwoord resetten",
    description: "Verstuurd als iemand een nieuw wachtwoord aanvraagt.",
    placeholders: ["resetUrl"],
    subject: "Wachtwoord resetten — Nugevonden",
    bodyHtml: `<h1>Nieuw wachtwoord instellen</h1>
<p>Je hebt gevraagd om een nieuw wachtwoord. Klik op de knop om er een te kiezen.</p>
<a class="knop" href="{{resetUrl}}">Nieuw wachtwoord instellen</a>
<p class="klein">De link is 15 minuten geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren; je wachtwoord blijft hetzelfde.</p>`,
  },
  order_confirmation: {
    label: "Bevestiging van bestelling",
    description: "Verstuurd naar de klant zodra de betaling gelukt is.",
    placeholders: ["domain", "amount", "orderUrl", "contentNoteHtml"],
    subject: "Bevestiging van je bestelling — Nugevonden",
    bodyHtml: `<h1>Bedankt voor je bestelling!</h1>
<p>We hebben je betaling ontvangen voor <strong>{{domain}}</strong>.</p>
<p>Bedrag: <strong>&euro;{{amount}}</strong> (incl. btw)</p>
{{contentNoteHtml}}
<a class="knop" href="{{orderUrl}}">Bekijk je order</a>`,
  },
  new_order_notification: {
    label: "Nieuwe order (publisher)",
    description: "Verstuurd naar een publisher zodra er een betaalde order voor hun site binnenkomt.",
    placeholders: ["domain", "amount", "ordersUrl"],
    subject: "Nieuwe order ontvangen — Nugevonden",
    bodyHtml: `<h1>Nieuwe order</h1>
<p>Je hebt een nieuwe betaalde order ontvangen voor <strong>{{domain}}</strong> (&euro;{{amount}}).</p>
<a class="knop" href="{{ordersUrl}}">Bekijk je orders</a>`,
  },
  order_published: {
    label: "Plaatsing live",
    description:
      "Verstuurd naar de klant zodra links van een order live staan; wat tegelijk live gaat in één mail, met wat er nog komt.",
    placeholders: ["liveLinksHtml", "stillToComeHtml", "orderUrl"],
    subject: "Je plaatsing staat live — Nugevonden",
    bodyHtml: `<h1>Je link staat live!</h1>
<p>Goed nieuws: dit staat nu online.</p>
<ul>{{liveLinksHtml}}</ul>
{{stillToComeHtml}}
<a class="knop" href="{{orderUrl}}">Bekijk je order</a>`,
  },
  placement_expiring: {
    label: "Plaatsing verloopt binnenkort",
    description: "Verstuurd naar de klant een maand voordat de periode van een plaatsing afloopt.",
    placeholders: ["domain", "liveUrl", "expiresOn", "renewUrl"],
    subject: "Je plaatsing op {{domain}} verloopt op {{expiresOn}} — Nugevonden",
    bodyHtml: `<h1>Je plaatsing verloopt binnenkort</h1>
<p>De periode van je plaatsing op <strong>{{domain}}</strong> loopt af op <strong>{{expiresOn}}</strong>:</p>
<p><a href="{{liveUrl}}">{{liveUrl}}</a></p>
<p>Verleng je niet, dan gaat de plaatsing na die datum offline.</p>
<a class="knop" href="{{renewUrl}}">Plaatsing verlengen</a>`,
  },
  content_reminder: {
    label: "Herinnering: inhoud aanleveren",
    description:
      "Verstuurd naar de klant 3, 7 en 30 dagen na betaling, zolang een betaalde link nog niet is ingevuld.",
    placeholders: ["domains", "orderNumber", "fillUrl"],
    subject: "Vergeet je niet je inhoud aan te leveren? Order #{{orderNumber}} — Nugevonden",
    bodyHtml: `<h1>We wachten nog op je inhoud</h1>
<p>Je hebt order #{{orderNumber}} betaald, maar voor <strong>{{domains}}</strong> hebben we je inhoud nog niet ontvangen.</p>
<p>Zodra je het invult, gaan we ermee aan de slag.</p>
<a class="knop" href="{{fillUrl}}">Nu invullen</a>`,
  },
  email_change: {
    label: "Nieuw e-mailadres bevestigen",
    description: "Verstuurd naar het nieuwe adres als een klant zijn e-mailadres wijzigt.",
    placeholders: ["newEmail", "confirmUrl"],
    subject: "Bevestig je nieuwe e-mailadres — Nugevonden",
    bodyHtml: `<h1>Bevestig je nieuwe e-mailadres</h1>
<p>Je wilt voortaan inloggen met <strong>{{newEmail}}</strong>.</p>
<a class="knop" href="{{confirmUrl}}">E-mailadres bevestigen</a>
<p class="klein">De link is 24 uur geldig. Tot je bevestigt, log je in met je huidige e-mailadres. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>`,
  },
  email_changed: {
    label: "E-mailadres gewijzigd",
    description: "Verstuurd naar het oude adres zodra een nieuw e-mailadres is bevestigd.",
    placeholders: ["newEmail"],
    subject: "Je e-mailadres is gewijzigd — Nugevonden",
    bodyHtml: `<h1>Je e-mailadres is gewijzigd</h1>
<p>Het e-mailadres van je Nugevonden-account is gewijzigd naar <strong>{{newEmail}}</strong>. Daarmee log je voortaan in.</p>
<p>Heb je dit niet zelf gedaan? Neem dan direct contact met ons op.</p>`,
  },
  password_changed: {
    label: "Wachtwoord gewijzigd",
    description: "Verstuurd zodra het wachtwoord van een account is gewijzigd of opnieuw ingesteld.",
    placeholders: [],
    subject: "Je wachtwoord is gewijzigd — Nugevonden",
    bodyHtml: `<h1>Je wachtwoord is gewijzigd</h1>
<p>Het wachtwoord van je Nugevonden-account is zojuist gewijzigd. Op andere apparaten ben je uitgelogd.</p>
<p>Heb je dit niet zelf gedaan? Neem dan direct contact met ons op.</p>`,
  },
  admin_login: {
    label: "Ingelogd op een admin-account",
    description: "Verstuurd na elke inlog op een admin-account, zodat een vreemde inlog meteen opvalt.",
    placeholders: ["when", "device", "ip", "notMeUrl"],
    subject: "Er is ingelogd op je admin-account — Nugevonden",
    bodyHtml: `<h1>Er is ingelogd op je admin-account</h1>
<div class="kader">Wanneer: <strong>{{when}}</strong><br>Apparaat: <strong>{{device}}</strong><br>IP-adres: <strong>{{ip}}</strong></div>
<p>Was jij dit? Dan hoef je niets te doen.</p>
<p>Was jij dit <strong>niet</strong>? Klik dan meteen op de knop: je account wordt op alle apparaten uitgelogd en je kiest een nieuw wachtwoord. Klanten merken hier niets van.</p>
<a class="knop" href="{{notMeUrl}}">Dit was ik niet</a>`,
  },
  account_locked: {
    label: "Account tijdelijk op slot",
    description: "Verstuurd als een account na 10 foute inlogpogingen op rij tijdelijk op slot gaat.",
    placeholders: ["minutes", "resetUrl"],
    subject: "Je account staat tijdelijk op slot — Nugevonden",
    bodyHtml: `<h1>Je account staat tijdelijk op slot</h1>
<p>Er is 10 keer achter elkaar met een verkeerd wachtwoord of een verkeerde code geprobeerd in te loggen op je account. Daarom staat het de komende {{minutes}} minuten op slot.</p>
<p>Was jij dit? Wacht dan even, of kies een nieuw wachtwoord.</p>
<p>Was jij dit <strong>niet</strong>? Kies dan voor de zekerheid een nieuw wachtwoord.</p>
<a class="knop" href="{{resetUrl}}">Nieuw wachtwoord kiezen</a>`,
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

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  const firstName = escapeHtml(name.trim().split(/\s+/)[0] || "daar");
  const { subject, html } = await renderTemplate("verification", { firstName, verifyUrl });
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

export async function sendPasswordChangedEmail(to: string) {
  const { subject, html } = await renderTemplate("password_changed", {});
  await sendSafely({ to, subject, html });
}

export async function sendAdminLoginEmail(
  to: string,
  login: { when: string; device: string; ip: string; notMeUrl: string }
) {
  const { subject, html } = await renderTemplate("admin_login", {
    when: escapeHtml(login.when),
    device: escapeHtml(login.device),
    ip: escapeHtml(login.ip),
    notMeUrl: login.notMeUrl,
  });
  await sendSafely({ to, subject, html });
}

export async function sendAccountLockedEmail(to: string, minutes: number, resetUrl: string) {
  const { subject, html } = await renderTemplate("account_locked", { minutes: String(minutes), resetUrl });
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
  liveLinks: { domain: string; liveUrl: string }[],
  // The order's links that follow later, e.g. "a2f.nl komt online op 5 oktober".
  stillToCome: string[] = []
) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const liveLinksHtml = liveLinks
    .map((l) => `<li><strong>${l.domain}</strong>: <a href="${l.liveUrl}">${l.liveUrl}</a></li>`)
    .join("");
  const { subject, html } = await renderTemplate("order_published", {
    liveLinksHtml,
    stillToComeHtml: stillToCome.length
      ? `<p>Nog te gaan:</p><ul>${stillToCome.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "",
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
    html: `<h1>${escapeHtml(subject)}</h1>
<p>${escapeHtml(message)}</p>
<a class="knop" href="${appUrl}/admin/settings?tab=systeem">Bekijk Instellingen → Systeem</a>`,
  });
}

// To the admins: a customer sent in the content for a link they had already
// paid for, so it can be reviewed or placed now.
export async function sendContentReceivedEmail(to: string, orderNumber: number, domain: string, orderItemId: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendSafely({
    to,
    subject: `Inhoud ontvangen voor order #${orderNumber} (${domain}) — Nugevonden`,
    html: `<h1>Inhoud ontvangen</h1>
<p>De klant heeft de inhoud aangeleverd voor <strong>${escapeHtml(domain)}</strong> (order #${orderNumber}).</p>
<a class="knop" href="${appUrl}/admin/orders/${orderItemId}">Bekijk de order</a>`,
  });
}
