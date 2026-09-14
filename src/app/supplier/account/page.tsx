import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import ConnectButton from "./ConnectButton";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import EditProfileSection from "@/components/EditProfileSection";

export default async function SupplierAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { stripe: stripeReturn } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) redirect("/login");

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.user.companyId } });

  // Re-sync onboarding status when Stripe redirects the user back — don't
  // wait solely on the account.updated webhook to reflect it in the UI.
  if (stripeReturn === "return" && company.stripeAccountId) {
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(company.stripeAccountId);
      const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);
      if (onboarded !== company.stripeAccountOnboarded) {
        await prisma.company.update({ where: { id: company.id }, data: { stripeAccountOnboarded: onboarded } });
        company.stripeAccountOnboarded = onboarded;
      }
    } catch (err) {
      console.error("Kon Stripe account status niet verversen", err);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl text-ink mb-1">Account</h1>
      <p className="text-sm text-inkSoft mb-6">{company.name}</p>

      <div className="bg-surface border border-line rounded-lg p-6 mb-6">
        <h2 className="font-medium text-ink mb-2">Gegevens</h2>
        <p className="text-sm text-inkSoft">Naam: {session.user.name}</p>
        <p className="text-sm text-inkSoft">E-mail: {session.user.email}</p>
        <div className="mt-3">
          <EditProfileSection initialName={session.user.name ?? ""} initialCompanyName={company.name} />
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6">
        <h2 className="font-medium text-ink mb-2">Uitbetalingen (Stripe)</h2>
        {company.stripeAccountOnboarded ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Je Stripe-account is verbonden en klaar om uitbetalingen te ontvangen.
          </div>
        ) : (
          <>
            <p className="text-sm text-inkSoft mb-4">
              Verbind je Stripe-account om automatisch uitbetaald te worden zodra een order betaald is. Het
              platform houdt de marge in en betaalt de rest rechtstreeks aan jou uit.
            </p>
            <ConnectButton />
          </>
        )}
      </div>

      <DeleteAccountSection userEmail={session.user.email ?? ""} />
    </div>
  );
}
