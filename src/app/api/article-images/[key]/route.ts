import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getArticleImageSignedUrl } from "@/lib/upload";

// Matches the randomUUID().ext filenames uploadArticleImage generates —
// guards against path traversal / arbitrary key lookups.
const KEY_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i;

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getServerSession(authOptions);
  // Any logged-in user can view an article image — these are draft blog
  // visuals, not sensitive documents, and the pages that embed them (cart,
  // admin order review) are already auth-gated themselves.
  if (!session) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const { key } = await params;
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Ongeldige afbeelding." }, { status: 400 });
  }

  try {
    const url = await getArticleImageSignedUrl(key);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Article image fetch failed", err);
    return NextResponse.json({ error: "Afbeelding niet gevonden." }, { status: 404 });
  }
}
