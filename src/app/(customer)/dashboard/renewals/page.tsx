import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REMINDER_DAYS_BEFORE } from "@/lib/placementPeriod";
import RenewButton from "../links/RenewButton";

export const metadata: Metadata = { title: "Verlengen" };

const nlDate = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });

// Every live link with an end date, soonest first — the ones inside the
// reminder window are marked, since those go offline if nobody renews them.
export default async function RenewalsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { customerId: session.user.id }, placement: { status: "published", expiresAt: { not: null } } },
    include: { websiteProduct: { include: { website: true, product: true } }, placement: true },
    orderBy: { placement: { expiresAt: "asc" } },
  });
  const expiringCount = items.filter((i) => i.placement!.expiresAt! <= soon).length;

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Verlengen</h1>
      <p className="text-sm text-inkSoft mb-6">
        {expiringCount > 0
          ? `${expiringCount} ${expiringCount === 1 ? "link verloopt" : "links verlopen"} binnen ${REMINDER_DAYS_BEFORE} dagen. Verleng op tijd, dan blijven ze gewoon online.`
          : "Je links lopen nog even door. Hier verleng je ze wanneer je wilt."}
      </p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Ankertekst</th>
              <th className="px-4 py-2 font-medium">Loopt tot</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const expiresAt = item.placement!.expiresAt!;
              const expiringSoon = expiresAt <= soon;
              return (
                <tr key={item.id} className={`border-t border-line ${expiringSoon ? "bg-amber-50/60" : ""}`}>
                  <td className="px-4 py-3 text-ink font-medium">{item.websiteProduct.website.domain}</td>
                  <td className="px-4 py-3 text-inkSoft">{item.websiteProduct.product.name}</td>
                  <td className="px-4 py-3 text-inkSoft">{item.anchorText ?? "—"}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${expiringSoon ? "text-amber-700 font-medium" : "text-inkSoft"}`}>
                    {nlDate(expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RenewButton orderItemId={item.id} />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen links om te verlengen.{" "}
                  <Link href="/marketplace?type=BLOG_POST" className="text-brand hover:underline">
                    Bekijk het aanbod
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
