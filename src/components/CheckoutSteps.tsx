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
  // before the current one. The cart passes this explicitly: "Invullen" is only
  // ticked once every link has its content.
  done?: number[];
}) {
  return (
    <ol className="mb-6 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        // Three clear states, like a normal checkout progress bar:
        //   done    — finished: a solid green circle with a check.
        //   current — where you are now: an open green ring with the number.
        //   future  — still to come: a plain grey circle and grey text.
        const isDone = done ? done.includes(n) : n < current;
        const isCurrent = !isDone && n === current;
        return (
          <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  isDone
                    ? "bg-[var(--btn-pay-bg)] text-white"
                    : isCurrent
                      ? "border-2 border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]"
                      : "bg-gray-200 text-inkSoft"
                }`}
              >
                {isDone ? <Check size={15} strokeWidth={3} /> : n}
              </span>
              <span
                // Words stay black (done + current) or a calm grey (still to
                // come); the green lives only in the circles, so the row doesn't
                // get busy with colour.
                className={`text-sm font-semibold ${
                  isDone || isCurrent ? "text-ink" : "text-inkSoft/70"
                }`}
              >
                {label}
              </span>
            </span>
            {/* The line turns green only once the step it leaves is finished. */}
            {i < STEPS.length - 1 && (
              <span className={`mx-3 h-0.5 flex-1 rounded ${isDone ? "bg-[var(--btn-pay-bg)]" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
