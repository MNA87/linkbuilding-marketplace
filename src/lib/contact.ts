// The WhatsApp button in the customer's top bar (Admin → Instellingen →
// Bedrijfsgegevens): the chat link for the number, and whether to say
// "Nu bereikbaar" (weekdays 9:00-17:00, Dutch time).

// "06 12345678" or "+31 6 1234 5678" → "31612345678" for wa.me; null when
// it isn't a phone number.
export function whatsappDigits(number: string): string | null {
  const trimmed = number.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  else if (!trimmed.startsWith("+") && digits.startsWith("0")) digits = `31${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export const whatsappUrl = (digits: string) => `https://wa.me/${digits}`;

export function reachableNow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return !["Sat", "Sun"].includes(weekday) && hour >= 9 && hour < 17;
}
