import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  if (!searchParams.token || !searchParams.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
        <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8 text-sm text-inkSoft">
          Ongeldige link. Vraag een nieuwe aan via{" "}
          <a href="/forgot-password" className="text-brand hover:underline">
            wachtwoord vergeten
          </a>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Nieuw wachtwoord instellen</h1>
        <p className="text-sm text-inkSoft mb-6">Kies een nieuw wachtwoord voor je account.</p>
        <ResetPasswordForm token={searchParams.token} email={searchParams.email} />
      </div>
    </div>
  );
}
