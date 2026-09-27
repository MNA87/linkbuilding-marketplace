import type { InputHTMLAttributes, ReactNode } from "react";

// The building blocks of the Account tabs: a white card with an optional
// bar at the bottom for its button, and labelled fields.

export function Card({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="px-5 pb-5 pt-5 sm:px-6">
        <h2 className="font-serif text-xl text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-inkSoft">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-line bg-gray-50/70 px-5 py-3.5 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SubHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-t border-line pt-5 sm:col-span-2">
      <h3 className="font-serif text-lg text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-inkSoft">{description}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)] read-only:bg-gray-100 read-only:text-inkSoft read-only:focus:ring-0";

export function Field({
  label,
  hint,
  wide,
  ...input
}: { label: string; hint?: string; wide?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-inkSoft">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-pay rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
    >
      {loading ? "Bezig..." : children}
    </button>
  );
}

// Feedback next to a card's button: green when saved, red on an error.
export function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <span role={message.ok ? "status" : "alert"} className={`mr-auto text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
      {message.text}
    </span>
  );
}
