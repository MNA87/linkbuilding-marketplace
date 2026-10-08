import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdf, invoicePdfInclude } from "@/lib/invoicePdf";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoicePdfInclude,
  });
  if (!invoice) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  // A customer may only download their own company's invoices; an admin may
  // download any.
  const isOwner = session.user.role === "customer" && invoice.customerCompanyId === session.user.companyId;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const pdfBytes = await generateInvoicePdf(invoice, settings);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
