import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import EditProfileSection from "@/components/EditProfileSection";

export default async function CustomerAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl text-ink mb-1">Account</h1>
      <p className="text-sm text-inkSoft mb-6">{session.user.companyName}</p>

      <div className="bg-surface border border-line rounded-lg p-6">
        <h2 className="font-medium text-ink mb-2">Gegevens</h2>
        <p className="text-sm text-inkSoft">Naam: {session.user.name}</p>
        <p className="text-sm text-inkSoft">E-mail: {session.user.email}</p>
        <div className="mt-3">
          <EditProfileSection
            initialName={session.user.name ?? ""}
            initialCompanyName={session.user.companyName ?? ""}
          />
        </div>
      </div>

      <DeleteAccountSection userEmail={session.user.email ?? ""} />
    </div>
  );
}
