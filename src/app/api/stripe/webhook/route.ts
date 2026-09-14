import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";

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
        await fulfillPaidOrder(
          orderId,
          session.id,
          typeof session.payment_intent === "string" ? session.payment_intent : null
        );
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
