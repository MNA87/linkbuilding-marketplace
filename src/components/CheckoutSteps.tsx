import { Check } from "lucide-react";

// The three steps of ordering, shown at the top of the order form and the
// cart so a customer always knows where they are: Kiezen (the marketplace) →
// Invullen (the article per link) → Afrekenen (the cart). Purely a guide; it
// doesn't gate anything — paying stays possible with links still to fill in.
const STEPS = ["Kiezen", "Invullen", "Afrekenen"] as const;

export default function CheckoutSteps({
  current,
  done,
}: {
  current: 1 | 2 | 3;
  // Which steps are genuinely finished (green check). Defaults to every step
  // before the current one. On the cart "Invullen" is only ticked once every
  // link has its content; paying stays possible regardless, so the cart stays
  // on the active "Afrekenen" step even with links left to fill in — a reached
  // but unticked step shows a plain (teal) number instead of a false check.
  done?: number[];
}) {
  return (
    <ol className="mb-6 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isDone = done ? done.includes(n) : n < current;
        // Reached = you're here or have passed through; it gets the accent
        // colour. Only a truly finished step shows the check.
        const reached = n <= current;
        return (
          <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  reached ? "bg-[var(--btn-pay-bg)] text-white" : "bg-gray-200 text-inkSoft"
                }`}
              >
                {isDone ? <Check size={15} strokeWidth={3} /> : n}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isDone ? "text-[var(--btn-pay-bg)]" : reached ? "text-ink" : "text-inkSoft/70"
                }`}
              >
                {label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mx-3 h-0.5 flex-1 rounded ${isDone ? "bg-[var(--btn-pay-bg)]" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
