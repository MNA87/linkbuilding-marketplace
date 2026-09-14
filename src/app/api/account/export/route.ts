import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// AVG/GDPR right to data portability — a JSON dump of everything tied to
// this account. Complements the right-to-erasure flow in
// src/lib/actions/account.ts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: true,
      company: {
        include: {
          projects: {
            include: {
              orders: {
                include: {
                  items: true,
                  invoices: true,
                },
              },
            },
          },
          websites: { include: { metrics: true, websiteProducts: true } },
          invoices: true,
        },
      },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      createdAt: user.createdAt,
    },
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          type: user.company.type,
          createdAt: user.company.createdAt,
          projects: user.company.projects,
          websites: user.company.websites,
          invoices: user.company.invoices,
        }
      : null,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mijn-gegevens.json"`,
    },
  });
}
