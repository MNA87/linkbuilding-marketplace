import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentPage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = { title: "Klanten" };

const PER_PAGE = 20;
const COLUMNS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_180px]";

const day = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const time = (d: Date) =>
  d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const where = { type: "CUSTOMER" as const };
  const total = await prisma.company.count({ where });
  const page = currentPage((await searchParams).pagina, Math.ceil(total / PER_PAGE));
  const companies = await prisma.company.findMany({
    where,
    include: { users: { select: { email: true } }, _count: { select: { customerPrices: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl text-ink sm:text-3xl">Klanten</h1>
      <p className="mt-1 text-sm text-inkSoft">{total === 1 ? "1 klant" : `${total} klanten`}</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {companies.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <span>Klant</span>
            <span>E-mailadres</span>
            <span>Aangemeld</span>
          </div>
        )}

        {companies.map((c) => (
          <div
            key={c.id}
            className={`grid ${COLUMNS} items-center gap-x-4 gap-y-0.5 border-t border-line/70 px-4 py-3.5 first:border-t-0 sm:px-5`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Link
                href={`/admin/customers/${c.id}`}
                className="truncate text-sm text-ink hover:text-brand hover:underline"
              >
                {c.name}
              </Link>
              {c.vatStatus === "mismatch" && (
                <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                  Btw: andere naam
                </span>
              )}
              {(c.discountPercent || c._count.customerPrices > 0 || c.writingIncluded) && (
                <span className="shrink-0 rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-xs text-ink/70">
                  Eigen prijzen
                </span>
              )}
              {!c.isBusiness && (
                <span className="shrink-0 rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-xs text-ink/70">
                  Particulier
                </span>
              )}
            </span>
            <span className="truncate text-sm text-ink/80">{c.users.map((u) => u.email).join(", ") || "–"}</span>
            <span className="whitespace-nowrap text-sm tabular-nums text-ink/80">
              {day(c.createdAt)} <span className="text-inkSoft">{time(c.createdAt)}</span>
            </span>
          </div>
        ))}

        {companies.length === 0 && <div className="px-5 py-10 text-center text-sm text-inkSoft">Nog geen klanten.</div>}
      </div>

      <Pagination
        page={page}
        perPage={PER_PAGE}
        total={total}
        noun="klanten"
        href={(n) => (n > 1 ? `/admin/customers?pagina=${n}` : "/admin/customers")}
      />
    </div>
  );
}
