import type { Metadata } from "next";
import AuthCard, { AuthError, authIntro, authTitle } from "@/components/AuthCard";
import NotMeButton from "./NotMeButton";

export const metadata: Metadata = { title: "Dit was ik niet" };

// From the mail after an admin login (src/lib/auth.ts).
export default async function NotMePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <AuthCard>
      <h1 className={authTitle}>Dit was ik niet</h1>
      <p className={authIntro}>
        Iemand anders heeft ingelogd op je account? Klik op de knop: je account wordt meteen op alle apparaten
        uitgelogd, en je krijgt een mail om een nieuw wachtwoord te kiezen. Klanten merken hier niets van.
      </p>
      {t ? (
        <NotMeButton token={t} />
      ) : (
        <div className="mt-6">
          <AuthError>Ongeldige link. Gebruik de knop uit de mail.</AuthError>
        </div>
      )}
    </AuthCard>
  );
}
