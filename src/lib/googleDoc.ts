import mammoth from "mammoth";

// A Google Doc linked in an order mail ("Docs URL: …"), read like a Word
// attachment. Only works when it's shared as "anyone with the link can
// view"; a private one sends you to Google's login page instead.

export function googleDocId(url: string): string | null {
  return /docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/.exec(url)?.[1] ?? null;
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function fetchGoogleDocHtml(
  url: string
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const id = googleDocId(url);
  if (!id) return { ok: false, error: "Geen geldige Google Docs-link" };
  try {
    const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=docx`, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || new URL(res.url).hostname.startsWith("accounts.") || !type.includes("officedocument")) {
      return { ok: false, error: "Google Doc niet te openen (niet gedeeld met 'iedereen met de link')" };
    }
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > MAX_BYTES) return { ok: false, error: "Google Doc is te groot (meer dan 10 MB)" };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_BYTES) return { ok: false, error: "Google Doc is te groot (meer dan 10 MB)" };
    const { value } = await mammoth.convertToHtml({ buffer });
    return { ok: true, html: value };
  } catch (err) {
    console.error("Reading Google Doc failed", (err as Error).message);
    return { ok: false, error: "Google Doc kon niet worden opgehaald" };
  }
}
