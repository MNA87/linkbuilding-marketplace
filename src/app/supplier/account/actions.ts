"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function createStripeOnboardingLink(): Promise<{ url?: string; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.user.companyId } });
  const stripe = getStripe();
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    let accountId = company.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: session.user.email ?? undefined,
        business_type: "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await prisma.company.update({ where: { id: company.id }, data: { stripeAccountId: accountId } });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/supplier/account`,
      return_url: `${appUrl}/supplier/account?stripe=return`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err) {
    console.error("Stripe onboarding link failed", err);
    return { error: "Stripe is nog niet (correct) geconfigureerd. Neem contact op met de beheerder." };
  }
}
