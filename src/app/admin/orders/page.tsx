import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { adminOrderRows } from "@/lib/adminOrders";
import { currentPage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import OrdersTable from "./OrdersTable";

export const metadata: Metadata = { title: "Orders" };

const PER_PAGE = 20;

const TABS = [
  { key: "actie", label: "Actie nodig" },
  { key: "actief", label: "Alle actieve" },
  { key: "archief", label: "Archief" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === params.view)?.key ?? "actief";

  const [active, archived] = await Promise.all([adminOrderRows("actief"), adminOrderRows("archief")]);
  const yours = active.filter((r) => r.next?.yours);
  const rows = tab === "actie" ? yours : tab === "archief" ? archived : active;
  const counts: Record<Tab, number> = { actie: yours.length, actief: active.length, archief: archived.length };

  const page = currentPage(params.pagina, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (view: Tab, pagina = 1) => {
    const q = new URLSearchParams();
    if (view !== "actief") q.set("view", view);
    if (pagina > 1) q.set("pagina", String(pagina));
    const s = q.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-inkSoft">
            {yours.length === 0
              ? "Er wacht niets op jou."
              : yours.length === 1
                ? "1 link wacht op jou."
                : `${yours.length} links wachten op jou.`}
          </p>
        </div>
        <Link
          href="/admin/orders/test"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-gray-50"
        >
          <Plus size={15} /> Testorder
        </Link>
      </div>

      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Filter">
        {TABS.map((t) => {
          const current = t.key === tab;
          const amber = t.key === "actie" && counts.actie > 0 && !current;
          return (
            <Link
              key={t.key}
              href={href(t.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                current
                  ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : amber
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`tabular-nums ${current ? "" : amber ? "" : "text-inkSoft"}`}>{counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>

      <OrdersTable
        rows={shown.map((r) => ({
          ...r,
          day: r.orderedAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }),
          time: r.orderedAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }),
        }))}
        archived={tab === "archief"}
        empty={
          tab === "actie" ? "Er wacht niets op jou." : tab === "archief" ? "Nog geen gearchiveerde orders." : "Nog geen actieve orders."
        }
      />

      <Pagination page={page} perPage={PER_PAGE} total={rows.length} noun="links" href={(n) => href(tab, n)} />
    </div>
  );
}
