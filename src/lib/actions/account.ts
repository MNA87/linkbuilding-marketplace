"use server";

import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type DeleteAccountState = { error: string | null; success: boolean };

// AVG/GDPR right to erasure. We anonymize rather than hard-delete the User
// row: orders, invoices, and payouts reference it and must be kept for
// accounting/legal retention and for the other party's own order history —
// deleting the row would either violate that or cascade-orphan real
// financial records. Every personally identifying field is scrubbed and the
// account is locked out; nothing about who they were remains queryable.
export async function deleteAccountAction(confirmEmail: string): Promise<DeleteAccountState> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: "Niet toegestaan.", success: false };
  }

  if (confirmEmail.trim().toLowerCase() !== session.user.email?.toLowerCase()) {
    return { error: "E-mailadres komt niet overeen. Typ je e-mailadres exact over.", success: false };
  }

  const unusablePasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      email: `deleted-${randomUUID()}@deleted.invalid`,
      name: "Verwijderde gebruiker",
      passwordHash: unusablePasswordHash,
      status: "deleted",
      deletedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
    },
  });

  return { error: null, success: true };
}
