import type { Metadata } from "next";
import Link from "next/link";
import { invitedUser } from "./invite";
import WelcomeForm from "./WelcomeForm";

export const metadata: Metadata = { title: "Welkom" };

// Where the invitation (Admin → Klanten → Uitnodigen) leads: choose a
// password, accept the voorwaarden, and in.
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  const user = token && email ? await invitedUser(email, token) : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-brandSoft/40 px-4 py-10 sm:py-14">
      <Link href="/" className="mb-6 font-serif text-[22px] text-ink">
        Nugevonden
      </Link>
      <main className="w-full max-w-[460px] rounded-3xl bg-surface px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        {user ? (
          <>
            <h1 className="font-serif text-[28px] tracking-tight text-ink">
              Welkom, {user.name.trim().split(/\s+/)[0] || "daar"}
            </h1>
            <p className="mt-1 text-sm text-inkSoft">
              Kies een wachtwoord voor <strong className="font-semibold text-ink">{user.email}</strong>. Daarna ben je
              meteen ingelogd.
            </p>
            <WelcomeForm email={user.email} token={token!} />
          </>
        ) : (
          <>
            <h1 className="font-serif text-[26px] tracking-tight text-ink">Deze link werkt niet meer</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              De link is verlopen of al gebruikt. Vraag Nugevonden om een nieuwe, of kies een wachtwoord via{" "}
              <Link href="/forgot-password" className="font-semibold text-[var(--btn-pay-bg)] hover:underline">
                wachtwoord vergeten
              </Link>
              .
            </p>
          </>
        )}
      </main>
    </div>
  );
}
