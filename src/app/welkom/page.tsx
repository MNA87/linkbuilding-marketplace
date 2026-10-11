import type { Metadata } from "next";
import Link from "next/link";
import { invitedUser } from "./invite";
import AuthCard, { authIntro, authLink, authTitle } from "@/components/AuthCard";
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
    <AuthCard>
      {user ? (
        <>
          <h1 className={authTitle}>Welkom, {user.name.trim().split(/\s+/)[0] || "daar"}</h1>
          <p className={authIntro}>
            Kies een wachtwoord voor <strong className="font-semibold text-ink">{user.email}</strong>. Daarna ben je
            meteen ingelogd.
          </p>
          <WelcomeForm email={user.email} token={token!} />
        </>
      ) : (
        <>
          <h1 className={authTitle}>Deze link werkt niet meer</h1>
          <p className={authIntro}>
            De link is verlopen of al gebruikt. Vraag Nugevonden om een nieuwe, of kies een wachtwoord via{" "}
            <Link href="/forgot-password" className={authLink}>
              wachtwoord vergeten
            </Link>
            .
          </p>
        </>
      )}
    </AuthCard>
  );
}
