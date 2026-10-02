// How a mail on Binnengekomen is shown: still to check, from someone who
// isn't a customer yet, set aside, or turned into an order.
export function mailStatus(mail: { status: string; customerId: string | null; isReply?: boolean }): {
  label: string;
  style: string;
} {
  if (mail.status === "ignored") return { label: "Genegeerd", style: "bg-gray-100 text-gray-600" };
  if (mail.isReply) {
    return mail.status === "done"
      ? { label: "Gelezen", style: "bg-gray-100 text-gray-600" }
      : { label: "Antwoord klant", style: "bg-blue-50 text-blue-700" };
  }
  if (mail.status === "done") return { label: "Order gemaakt", style: "bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" };
  if (!mail.customerId) return { label: "Klant onbekend", style: "bg-red-50 text-red-700" };
  return { label: "Te controleren", style: "bg-amber-100 text-amber-800" };
}

// What the customer sent along.
export function delivered(mail: {
  articleTitle: string | null;
  links: unknown;
  attachments: string[];
  isReply?: boolean;
}): string {
  if (mail.isReply) return "Antwoord";
  if (mail.articleTitle) return "Word-bestand";
  if (Array.isArray(mail.links) && mail.links.length > 0) return "Links in de mail";
  if (mail.attachments.length > 0) return "Bijlage";
  return "Alleen tekst";
}

export const mailTime = (d: Date) =>
  d.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
