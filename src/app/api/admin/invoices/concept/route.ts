import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pendingCollectiveGroup } from "@/lib/collectiveInvoices";
import { draftCollectivePdf } from "@/lib/collectiveInvoicePdf";

// Admin → Verzamelfacturen → "Concept bekijken": the PDF before it's made.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const group = await pendingCollectiveGroup(key);
  if (!group) return NextResponse.json({ error: "Niets meer te factureren." }, { status: 404 });
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const pdf = await draftCollectivePdf(group, settings);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="concept.pdf"' },
  });
}
