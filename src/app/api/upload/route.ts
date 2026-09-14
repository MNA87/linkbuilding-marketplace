import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadOrderFile, UploadValidationError } from "@/lib/upload";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  // Only logged-in customers attach files to an order they're placing.
  if (!session || session.user.role !== "customer") {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }

  try {
    const key = await uploadOrderFile(file);
    return NextResponse.json({ key });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Uploaden is mislukt." }, { status: 500 });
  }
}
