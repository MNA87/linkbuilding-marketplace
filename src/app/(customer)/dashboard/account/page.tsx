import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Company, User } from "@prisma/client";
import MyDetailsForm, { type DetailsValues } from "./MyDetailsForm";
import EmailForm from "./EmailForm";
import PasswordForm from "./PasswordForm";
import DeleteAccount from "./DeleteAccount";
import { Card } from "./ui";

export const metadata: Metadata = { title: "Account" };

const TABS = [
  { key: "gegevens", label: "Mijn gegevens" },
  { key: "inloggen", label: "Inloggen" },
  { key: "privacy", label: "Privacy" },
] as const;
type Tab = (typeof TABS)[number]["key"];

// Customers from before the own-address fields have only the invoice
// address: that's theirs too, until they change it.
function detailsOf(user: User, company: Company): DetailsValues {
  const hasOwn = Boolean(user.address);
  const own = hasOwn
    ? { address: user.address ?? "", postcode: user.postcode ?? "", city: user.city ?? "" }
    : { address: company.billingAddress, postcode: company.billingPostcode, city: company.billingCity };
  const sameAddress =
    own.address === company.billingAddress && own.postcode === company.billingPostcode && own.city === company.billingCity;
  return {
    name: user.name,
    ...own,
    phone: user.phone ?? "",
    isBusiness: company.isBusiness,
    companyName: company.isBusiness ? company.name : "",
    vatNumber: company.vatNumber ?? "",
    sameAddress,
    billingAddress: sameAddress ? "" : company.billingAddress,
    billingPostcode: sameAddress ? "" : company.billingPostcode,
    billingCity: sameAddress ? "" : company.billingCity,
  };
}

export default async function CustomerAccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "gegevens";

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { company: true },
  });
  const company = user.company!;

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-5 font-serif text-2xl text-ink">Account</h1>

      <nav className="-mx-4 mb-5 flex overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Account">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "gegevens" ? "/dashboard/account" : `/dashboard/account?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
              t.key === tab
                ? "border-[var(--btn-pay-bg)] font-semibold text-[var(--btn-pay-bg)]"
                : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "gegevens" && <MyDetailsForm initial={detailsOf(user, company)} />}

      {tab === "inloggen" && (
        <div className="space-y-5">
          <EmailForm email={user.email} pendingEmail={user.pendingEmail} />
          <PasswordForm />
          <Card title="Tweestapsverificatie">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-inkSoft">
                <Lock size={18} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-ink">Tweestapsverificatie staat uit.</p>
                <p className="text-inkSoft">Extra beveiliging met een code uit een app op je telefoon.</p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-inkSoft">
                Binnenkort
              </span>
            </div>
          </Card>
        </div>
      )}

      {tab === "privacy" && (
        <Card title="Privacy" description="Je gegevens downloaden of je account verwijderen.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Download je gegevens</p>
                <p className="text-sm text-inkSoft">Een kopie van alles wat we over jou en je bedrijf hebben.</p>
              </div>
              <a
                href="/api/account/export"
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50 sm:self-auto"
              >
                <Download size={15} /> Downloaden
              </a>
            </div>
            <DeleteAccount email={user.email} />
          </div>
        </Card>
      )}
    </div>
  );
}
