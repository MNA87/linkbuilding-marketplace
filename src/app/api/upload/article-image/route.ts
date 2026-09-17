import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadArticleImage, UploadValidationError } from "@/lib/upload";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  // Customers insert images while writing an article; admin gets the same
  // path for creating test orders (see /admin/orders/test).
  if (!session || (session.user.role !== "customer" && session.user.role !== "admin")) {
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
