import { NextResponse } from "next/server";
import { getMediaBytes } from "@/lib/cms/media";

// Afbeeldingen van de publieke site (blog). Openbaar: ze staan op publito.nl.
// Het id is een cuid en de inhoud verandert nooit, dus lang te cachen.
const ID_RE = /^[a-z0-9]{10,40}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return new NextResponse("Ongeldig", { status: 400 });
  try {
    const m = await getMediaBytes(id);
    if (!m) return new NextResponse("Niet gevonden", { status: 404 });
    return new NextResponse(new Uint8Array(m.buffer), {
      headers: {
        "Content-Type": m.mime,
        "Content-Length": String(m.buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("media: ophalen mislukt", err);
    return new NextResponse("Niet beschikbaar", { status: 503 });
  }
}
