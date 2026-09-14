import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET ontbreekt.");
    return NextResponse.json({ error: "Webhook niet geconfigureerd." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature invalid", err);
    return NextResponse.json({ error: "Ongeldige signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
        // Idempotency: Stripe can deliver the same event more than once.
        // Only run payment/transfer/notification side effects the first
        // time this order transitions out of NEW.
        const alreadyProcessed = existingOrder?.status !== "NEW";

        await prisma.$transaction([
          prisma.order.update({
            where: { id: orderId },
            data: { status: "PAID", paidAt: new Date() },
          }),
          prisma.payment.updateMany({
            where: { orderId, providerRef: session.id },
            data: { status: "paid", providerRef: (session.payment_intent as string) ?? session.id },
          }),
        ]);

        if (!alreadyProcessed) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
              customer: true,
              items: {
                include: {
                  websiteProduct: { include: { website: { include: { company: { include: { users: true } } } } } },
                },
              },
            },
          });

          if (order) {
            const totalAmount = order.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0).toFixed(2);
            const domains = order.items.map((i) => i.websiteProduct.website.domain).join(", ");

            if (order.customer.companyId) {
              await prisma.invoice.upsert({
                where: { orderId: order.id },
                create: {
                  invoiceNumber: `INV-${new Date().getFullYear()}-${order.id.slice(-8).toUpperCase()}`,
                  amount: totalAmount,
                  customerCompanyId: order.customer.companyId,
                  orderId: order.id,
                },
                update: {},
              });
            }

            // A cart can hold links from several publishers, so the charge
            // went to the platform in full (no transfer_data on the
            // PaymentIntent) — split it out per publisher now with separate
            // Transfers, tied to the original charge via source_transaction
            // so it draws from those specific funds rather than the
            // platform's general balance.
            if (typeof session.payment_intent === "string") {
              try {
                const stripe = getStripe();
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                const chargeId =
                  typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : undefined;

                const byPublisher = new Map<string, { stripeAccountId: string; amount: number }>();
                for (const item of order.items) {
                  const company = item.websiteProduct.website.company;
                  if (!company.stripeAccountId) continue;
                  const existing = byPublisher.get(company.id);
                  const amount = item.supplierPriceSnap.toNumber();
                  byPublisher.set(company.id, {
                    stripeAccountId: company.stripeAccountId,
                    amount: (existing?.amount ?? 0) + amount,
                  });
                }

                for (const [companyId, { stripeAccountId, amount }] of Array.from(byPublisher)) {
                  await stripe.transfers.create({
                    amount: Math.round(amount * 100),
                    currency: "eur",
                    destination: stripeAccountId,
                    transfer_group: order.id,
                    source_transaction: chargeId,
                    metadata: { orderId: order.id, companyId },
                  });
                }
              } catch (err) {
                // Payment already succeeded — a transfer failure must not
                // look like a webhook failure (Stripe would retry the whole
                // event). Log loudly so an admin can create the transfer
                // manually from the Stripe dashboard.
                console.error(`Publisher transfer(s) failed for order ${order.id}`, err);
              }
            }

            await sendOrderConfirmationEmail(order.customer.email, order.id, domains, totalAmount);

            const notifiedCompanies = new Set<string>();
            for (const item of order.items) {
              const company = item.websiteProduct.website.company;
              if (notifiedCompanies.has(company.id)) continue;
              notifiedCompanies.add(company.id);
              const publisherUser = company.users[0];
              if (publisherUser) {
                await sendNewOrderNotificationEmail(
                  publisherUser.email,
                  item.websiteProduct.website.domain,
                  item.customerPriceSnap.toFixed(2)
                );
              }
            }
          }
        }
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await prisma.payment.updateMany({
          where: { orderId, providerRef: session.id },
          data: { status: "expired" },
        });
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await prisma.company.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeAccountOnboarded: Boolean(account.charges_enabled && account.payouts_enabled) },
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
