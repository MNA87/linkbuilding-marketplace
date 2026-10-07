import type { Metadata } from "next";
import NotMeButton from "./NotMeButton";

export const metadata: Metadata = { title: "Dit was ik niet" };

// From the mail after an admin login (src/lib/auth.ts).
export default async function NotMePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Dit was ik niet</h1>
        <p className="mt-3 text-sm text-inkSoft">
          Iemand anders heeft ingelogd op je account? Klik op de knop: je account wordt meteen op alle apparaten
          uitgelogd, en je krijgt een mail om een nieuw wachtwoord te kiezen. Klanten merken hier niets van.
        </p>
        {t ? (
          <NotMeButton token={t} />
        ) : (
          <p className="mt-4 text-sm text-red-600">Ongeldige link. Gebruik de knop uit de mail.</p>
        )}
      </div>
    </div>
  );
}
