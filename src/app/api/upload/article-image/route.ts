import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadArticleImage, UploadValidationError } from "@/lib/upload";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  // Only logged-in customers insert images while writing an article.
  if (!session || session.user.role !== "customer") {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }

  try {
    const key = await uploadArticleImage(file);
    return NextResponse.json({ key, url: `/api/article-images/${key}` });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Article image upload failed", err);
    return NextResponse.json({ error: "Uploaden is mislukt." }, { status: 500 });
  }
}
