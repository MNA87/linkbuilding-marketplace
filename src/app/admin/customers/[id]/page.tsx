import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerPricesForm from "./CustomerPricesForm";
import VatButtons from "./VatButtons";
import { countryName, isEuCountry } from "@/lib/countries";

const VAT_LABEL: Record<string, string> = {
  none: "Niet gecontroleerd",
  valid: "Btw verlegd · gecontroleerd",
  mismatch: "Btw verlegd · andere naam in VIES",
  approved: "Btw verlegd · door jou bekeken",
  unreachable: "VIES niet bereikbaar · 21% tot de controle lukt",
  invalid: "Ongeldig · 21% btw",
};
const VAT_PILL: Record<string, string> = {
  none: "bg-gray-100 text-ink/70",
  valid: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  mismatch: "bg-amber-100 text-amber-800",
  unreachable: "bg-gray-100 text-ink/70",
  invalid: "bg-red-100 text-red-700",
};

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

      {company.vatNumber && company.country !== "NL" && (
        <section className="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-lg text-ink">Btw</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VAT_PILL[company.vatStatus] ?? VAT_PILL.none}`}
            >
              {VAT_LABEL[company.vatStatus] ?? VAT_LABEL.none}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-inkSoft">Land</dt>
            <dd className="text-ink">{countryName(company.country)}</dd>
            <dt className="text-inkSoft">Btw-nummer</dt>
            <dd className="text-ink">{company.vatNumber}</dd>
            <dt className="text-inkSoft">Volgens VIES</dt>
            <dd className="text-ink">
              {company.vatCheckName ?? <span className="text-inkSoft">geen naam gegeven</span>}
              {company.vatCheckAddress && <span className="block text-inkSoft">{company.vatCheckAddress}</span>}
            </dd>
            <dt className="text-inkSoft">Gecontroleerd</dt>
            <dd className="text-ink">
              {company.vatCheckedAt ? day(company.vatCheckedAt) : "nog niet"}
              {company.vatCheckRef && <span className="text-inkSoft"> · raadplegingsnummer {company.vatCheckRef}</span>}
            </dd>
          </dl>
          {company.vatStatus === "mismatch" && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Ter info: het btw-nummer is geldig, maar VIES noemt een andere bedrijfsnaam dan de klant invulde. De klant
              betaalt al geen Nederlandse btw (btw verlegd). Klopt het? Klik op &ldquo;Gezien&rdquo;. Twijfel je, klik
              op &ldquo;Afwijzen&rdquo;: dan betaalt de klant voortaan 21%.
            </p>
          )}
          {company.vatStatus === "unreachable" && (
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-inkSoft">
              VIES gaf geen antwoord. Het platform probeert het elk uur en bij het afrekenen opnieuw.
            </p>
          )}
          <VatButtons companyId={company.id} canDecide={isEuCountry(company.country)} />
        </section>
      )}

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
