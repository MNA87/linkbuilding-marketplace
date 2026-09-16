import { Resend } from "resend";

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

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await sendSafely({
    to,
    subject: "Bevestig je e-mailadres — Nugevonden",
    html: `
      <p>Bedankt voor je registratie bij Nugevonden.</p>
      <p><a href="${verifyUrl}">Klik hier om je e-mailadres te bevestigen</a>. Deze link is 24 uur geldig.</p>
      <p>Je kunt pas inloggen nadat je je e-mailadres hebt bevestigd.</p>
      <p>Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendSafely({
    to,
    subject: "Wachtwoord resetten — Nugevonden",
    html: `
      <p>Je hebt een wachtwoordreset aangevraagd.</p>
      <p><a href="${resetUrl}">Klik hier om een nieuw wachtwoord in te stellen</a>. Deze link is 15 minuten geldig.</p>
      <p>Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
    `,
  });
}

export async function sendOrderConfirmationEmail(to: string, orderId: string, domain: string, amount: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendSafely({
    to,
    subject: "Bevestiging van je bestelling — Nugevonden",
    html: `
      <p>Bedankt voor je bestelling voor <strong>${domain}</strong>.</p>
      <p>Bedrag: &euro;${amount}</p>
      <p><a href="${appUrl}/dashboard/orders/${orderId}">Bekijk je order</a>.</p>
    `,
  });
}

export async function sendNewOrderNotificationEmail(to: string, domain: string, amount: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendSafely({
    to,
    subject: "Nieuwe order ontvangen — Nugevonden",
    html: `
      <p>Je hebt een nieuwe betaalde order ontvangen voor <strong>${domain}</strong> (&euro;${amount}).</p>
      <p><a href="${appUrl}/supplier/orders">Bekijk je orders</a>.</p>
    `,
  });
}
