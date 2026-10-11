import Link from "next/link";
import type { ReactNode } from "react";

// The page around logging in, registering and the other account screens
// (wachtwoord vergeten, bevestigen, welkom): the name on top and one white
// card on a light background, so they all look the same.
export default function AuthCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-brandSoft/40 px-4 py-10 sm:py-14">
      <Link href="/" className="mb-6 font-serif text-[22px] text-ink">
        Nugevonden
      </Link>
      <main
        className={`w-full ${wide ? "max-w-[560px]" : "max-w-[460px]"} rounded-3xl bg-surface px-6 py-8 shadow-sm sm:px-10 sm:py-10`}
      >
        {children}
      </main>
    </div>
  );
}

// The same title, intro, button, link and messages on every such screen.
export const authTitle = "font-serif text-[28px] tracking-tight text-ink";
export const authIntro = "mt-1 text-sm leading-relaxed text-inkSoft";
export const authButton =
  "btn-pay block w-full rounded-lg py-3 text-center text-[15px] font-semibold transition disabled:opacity-60";
export const authLink = "font-semibold text-[var(--btn-pay-bg)] hover:underline";

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    >
      {children}
    </div>
  );
}
