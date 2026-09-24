import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { downloadPixabayImage, pixabayConfigured } from "@/lib/pixabay";
import { uploadArticleImage, UploadValidationError } from "@/lib/upload";

// Pixabay forbids permanent hotlinking, so a chosen photo is copied into
// our own storage right away — from then on it's handled exactly like an
// image the customer uploaded themselves, and ends up in the target site's
// own WordPress media library on publish.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "customer" && session.user.role !== "admin")) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }
  if (!pixabayConfigured()) {
    return NextResponse.json({ error: "Foto's zoeken is nog niet ingesteld." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ongeldige foto." }, { status: 400 });
  }
  if (isRateLimited(`photo-select:${session.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Even rustig aan — probeer het over een minuut opnieuw." }, { status: 429 });
  }

  try {
    const { file } = await downloadPixabayImage(id);
    const key = await uploadArticleImage(file);
    return NextResponse.json({ key, url: `/api/article-images/${key}` });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Pixabay select failed", err);
    return NextResponse.json({ error: "Deze foto kon niet worden toegevoegd. Kies een andere." }, { status: 502 });
  }
}
