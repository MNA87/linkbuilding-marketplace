import ClickableRow from "@/components/ClickableRow";

export type OrderRow = {
  id: string;
  orderNumber: number;
  href: string;
  kind: "blog" | "homepage";
  domain: string;
  extra: number;
  stageLabel: string;
  stageClass: string;
  dateLabel: string;
  amountLabel: string;
  unread: number;
};

// Mijn orders als marktplaats-tabel: grijze kopregel, zachte haarlijntjes,
// elk gegeven in een eigen kolom (Order · Site · Status · Datum · Bedrag). De
// hele rij opent de order.
const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-ink whitespace-nowrap";
const THR = `${TH} text-right`;
const TD = "px-3.5 py-3 align-middle";
const TDR = "px-3.5 py-3 text-right align-middle tabular-nums text-ink whitespace-nowrap";
const BADGE = "inline-flex min-w-[124px] justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold";

export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${TH} w-[10%]`}>Order</th>
            <th className={`${TH} w-[24%]`}>Datum</th>
            <th className={`${TH} w-[28%]`}>Site</th>
            <th className={`${TH} w-[22%]`}>Status</th>
            <th className={`${THR} w-[16%]`}>Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ClickableRow key={r.id} href={r.href} className="border-t border-line/70 hover:bg-gray-50/60">
              <td className={`${TD} whitespace-nowrap tabular-nums text-ink`}>#{r.orderNumber}</td>
              <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{r.dateLabel}</td>
              <td className={TD}>
                <div className="flex items-center gap-2">
                  <span className="text-ink">{r.domain}</span>
                  {r.extra > 0 && (
                    <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                  )}
                </div>
              </td>
              <td className={TD}>
                <span className={`${BADGE} ${r.stageClass}`}>{r.stageLabel}</span>
                {r.unread > 0 && (
                  <span className="ml-2 inline-flex align-middle text-[11px] font-semibold text-[var(--btn-pay-bg)]">
                    {r.unread === 1 ? "1 reactie" : `${r.unread} reacties`}
                  </span>
                )}
              </td>
              <td className={TDR}>€{r.amountLabel}</td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
