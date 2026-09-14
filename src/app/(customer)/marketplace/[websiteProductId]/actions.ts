"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import { createOrderSchema } from "@/lib/validations/order";

export type CreateOrderState = { error: string | null; checkoutUrl?: string };

export async function createOrderAction(input: unknown): Promise<CreateOrderState> {
  const session = await getServerSession(authOptions);
  // Explicit role check — never rely on middleware alone for anything that
  // touches money or creates orders on someone's behalf.
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const data = parsed.data;

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: { include: { company: true } } },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar." };
  }

  const publisherCompany = websiteProduct.website.company;
  if (!publisherCompany.stripeAccountId || !publisherCompany.stripeAccountOnboarded) {
    return { error: "Deze publisher heeft de uitbetaling nog niet ingesteld. Probeer het later opnieuw." };
  }

  if (data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project || project.customerCompanyId !== session.user.companyId) {
      return { error: "Ongeldig project." };
    }
  }

  // Never trust a price from the client — recompute server-side from the
  // current supplier price + margin rules.
  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const order = await prisma.$transaction(async (tx) => {
    const projectId =
      data.projectId ??
      (
        await tx.project.create({
          data: { name: data.newProjectName!, customerCompanyId: session.user.companyId! },
        })
      ).id;

    return tx.order.create({
      data: {
        customerId: session.user.id,
        projectId,
        items: {
          create: {
            websiteProductId: websiteProduct.id,
            supplierPriceSnap: supplierPrice,
            customerPriceSnap: customerPrice,
            marginSnap: marginPercent,
            targetUrl: data.targetUrl,
            anchorText: data.anchorText,
            comments: data.comments || null,
            contentSource: data.contentSource,
            articleTitle: data.articleTitle || null,
            articleBody: data.articleBody || null,
            uploadedFileUrl: data.uploadedFileUrl || null,
          },
        },
      },
      include: { items: true },
    });
  });

  const orderItem = order.items[0];
  const platformFee = customerPrice.sub(supplierPrice);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(customerPrice.toNumber() * 100),
            product_data: { name: `${websiteProduct.website.domain} — plaatsing` },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(platformFee.toNumber() * 100),
        transfer_data: { destination: publisherCompany.stripeAccountId },
        metadata: { orderId: order.id },
      },
      metadata: { orderId: order.id, orderItemId: orderItem.id },
      success_url: `${appUrl}/dashboard/orders/${order.id}?checkout=success`,
      cancel_url: `${appUrl}/dashboard/orders/${order.id}?checkout=cancelled`,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "stripe",
        providerRef: checkoutSession.id,
        amount: customerPrice,
        status: "pending",
      },
    });

    return { error: null, checkoutUrl: checkoutSession.url ?? undefined };
  } catch (err) {
    console.error("Stripe checkout session failed", err);
    // The order row stays as NEW — nothing was charged, so this is safe to
    // just report back rather than roll back.
    return { error: "Kon geen betaalpagina aanmaken. Probeer het later opnieuw." };
  }
}
