import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { pixabayConfigured, searchPixabay } from "@/lib/pixabay";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "customer" && session.user.role !== "admin")) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }
  if (!pixabayConfigured()) {
    return NextResponse.json({ error: "Foto's zoeken is nog niet ingesteld." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const term = (searchParams.get("q") ?? "").trim();
  const page = Math.min(Math.max(Number(searchParams.get("page")) || 1, 1), 20);
  if (term.length < 2) {
    return NextResponse.json({ error: "Typ minimaal 2 tekens." }, { status: 400 });
  }
  if (isRateLimited(`photo-search:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Even rustig aan — probeer het over een minuut opnieuw." }, { status: 429 });
  }

  try {
    return NextResponse.json(await searchPixabay(term, page));
  } catch (err) {
    console.error("Pixabay search failed", err);
    return NextResponse.json({ error: "Zoeken lukte niet. Probeer het later opnieuw." }, { status: 502 });
  }
}
