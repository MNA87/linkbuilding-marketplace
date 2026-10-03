import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerPricesForm from "./CustomerPricesForm";

export const metadata: Metadata = { title: "Klant" };

const day = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

// One customer, with the prices agreed with them.
export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company, products, settings] = await Promise.all([
    prisma.company.findFirst({
      where: { id, type: "CUSTOMER" },
      include: {
        users: { select: { name: true, email: true } },
        customerPrices: { select: { websiteProductId: true, price: true } },
      },
    }),
    prisma.websiteProduct.findMany({
      include: { website: { select: { domain: true } }, product: { select: { name: true } } },
      orderBy: [{ website: { domain: "asc" } }, { product: { type: "asc" } }],
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { writingPrice: true } }),
  ]);
  if (!company) notFound();
  const fixed = new Map(company.customerPrices.map((p) => [p.websiteProductId, p.price]));
  const plain = (n: { toFixed: (d: number) => string }) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

  return (
    <div className="max-w-4xl">
      <Link href="/admin/customers" className="text-sm text-brand hover:underline">
        &larr; Terug naar Klanten
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">{company.name}</h1>
      <p className="mt-1 text-sm text-inkSoft">
        {company.users.map((u) => [u.name, u.email].filter(Boolean).join(" · ")).join(", ") || "–"} · klant sinds{" "}
        {day(company.createdAt)}
      </p>

      <section className="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-serif text-lg text-ink">Prijzen voor deze klant</h2>
        <p className="mt-1 text-sm text-inkSoft">
          Een vaste prijs gaat voor de korting. Leeg = standaardprijs. Geldt voor orders uit de mail én als de klant
          zelf bestelt; orders die er al zijn houden hun prijs.
        </p>
        <CustomerPricesForm
          companyId={company.id}
          discount={company.discountPercent ? plain(company.discountPercent) : ""}
          writingIncluded={company.writingIncluded}
          writingPrice={Number(settings?.writingPrice ?? 25)}
          rows={products.map((p) => ({
            id: p.id,
            domain: p.website.domain,
            product: p.product.name,
            standard: p.supplierPrice.toNumber(),
            fixed: fixed.has(p.id) ? plain(fixed.get(p.id)!) : "",
          }))}
        />
      </section>
    </div>
  );
}
