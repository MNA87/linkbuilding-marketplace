import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumbers } from "@/lib/pagination";

// "5–8 van 9 orders" with Vorige / page numbers / Volgende under a list.
// Nothing when it all fits on one page.
export default function Pagination({
  page,
  perPage,
  total,
  noun,
  href,
}: {
  page: number;
  perPage: number;
  total: number;
  // What's being counted, plural: "orders", "facturen".
  noun: string;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const step = "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5";
  return (
    <nav aria-label="Pagina's" className="mt-4 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
      <span className="text-inkSoft">
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} van {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${step} text-ink hover:bg-gray-100`}>
            <ChevronLeft size={15} /> Vorige
          </Link>
        ) : (
          <span className={`${step} text-inkSoft/50`}>
            <ChevronLeft size={15} /> Vorige
          </span>
        )}
        {pageNumbers(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="px-1.5 text-inkSoft">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              aria-current={n === page ? "page" : undefined}
              className={`min-w-[2rem] rounded-md px-2 py-1.5 text-center tabular-nums ${
                n === page
                  ? // Soft action colour, calmer than black (Instellingen → Knopkleuren).
                    "border border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : "border border-transparent text-ink hover:bg-gray-100"
              }`}
            >
              {n}
            </Link>
          )
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={`${step} text-ink hover:bg-gray-100`}>
            Volgende <ChevronRight size={15} />
          </Link>
        ) : (
          <span className={`${step} text-inkSoft/50`}>
            Volgende <ChevronRight size={15} />
          </span>
        )}
      </div>
    </nav>
  );
}
