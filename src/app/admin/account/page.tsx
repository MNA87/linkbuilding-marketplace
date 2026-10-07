import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TwoFactorCard from "@/components/TwoFactorCard";
import { Card } from "@/app/(customer)/dashboard/account/ui";

export const metadata: Metadata = { title: "Account" };

const nlDay = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// The admin's own login: tweestapsverificatie is required for this account.
export default async function AdminAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true, totpEnabledAt: true, totpBackupCodes: true },
  });

  return (
    <div className="max-w-[640px] space-y-5">
      <h1 className="font-serif text-2xl text-ink">Account</h1>
      <Card title="Inloggen" description={`Je logt in met ${user.email}. Een admin-inlog is 1 dag geldig.`}>
        <p className="text-sm text-inkSoft">
          Na elke inlog krijg je een mail. Was jij het niet, dan log je met één klik iedereen uit.
        </p>
      </Card>
      <Card title="Tweestapsverificatie" description="Verplicht voor een admin-account.">
        <TwoFactorCard
          enabledAt={user.totpEnabledAt ? nlDay(user.totpEnabledAt) : null}
          backupLeft={user.totpBackupCodes.length}
          required
        />
      </Card>
    </div>
  );
}
