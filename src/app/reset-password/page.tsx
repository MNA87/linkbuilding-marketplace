import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  if (!token || !email) {
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
        <ResetPasswordForm token={token} email={email} />
      </div>
    </div>
  );
}
