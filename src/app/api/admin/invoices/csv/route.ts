import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoicePeriod } from "@/lib/invoicePeriod";

// Semicolons and decimal commas, so Dutch Excel opens it straight away.
function cell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
const money = (n: { toFixed(d: number): string }) => n.toFixed(2).replace(".", ",");

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = invoicePeriod(url.searchParams.get("jaar") ?? undefined, url.searchParams.get("kwartaal") ?? undefined);
  const invoices = await prisma.invoice.findMany({
    where: { issuedAt: { gte: period.from, lt: period.to } },
    include: { customerCompany: true, order: { select: { orderNumber: true } }, creditsInvoice: true },
    orderBy: { issuedAt: "asc" },
  });

  const rows = [
    ["Factuurnummer", "Soort", "Datum", "Klant", "BTW-nummer klant", "Order", "Excl. BTW", "BTW %", "BTW", "Incl. BTW", "Crediteert"],
    ...invoices.map((i) => [
      i.invoiceNumber,
      i.type === "CREDIT" ? "Creditfactuur" : "Factuur",
      i.issuedAt.toLocaleDateString("nl-NL"),
      i.customerCompany.name,
      i.customerCompany.vatNumber ?? "",
      `#${i.order.orderNumber}`,
      money(i.subtotal),
      i.vatRate.toNumber().toString(),
      money(i.vatAmount),
      money(i.amount),
      i.creditsInvoice?.invoiceNumber ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturen-${period.label.replace(" ", "-")}.csv"`,
    },
  });
}
