import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail, sendNewOrderNotificationEmail, sendOrderPublishedEmail } from "@/lib/email";
import { publishToWordPress, isWordPressConfigured } from "@/lib/wordpress";
import { getAutoPublishEnabled } from "@/lib/siteSettings";

// Called after any placement gets (or might get) a live URL — a direct
// WordPress publish, an admin pasting a live URL by hand, a publisher
// confirming their own placement, or WP Sync's ack once a draft is
// actually published in WordPress. Flips the order to PUBLISHED and
// emails the customer the live link(s) the first time every item in it
// has one. Checking the order's current status before updating is the
// idempotency guard — the same pattern fulfillPaidOrder below uses for its
// own one-time side effects — so calling this again for an
// already-published order (or one where a sibling item still isn't live)
// is always a safe no-op.
export async function finalizeOrderIfFullyPublished(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { placement: true, websiteProduct: { include: { website: true } } } },
    },
  });
  if (!order || order.status === "PUBLISHED") return;
  if (order.items.length === 0 || !order.items.every((i) => i.placement?.liveUrl)) return;

  await prisma.order.update({ where: { id: orderId }, data: { status: "PUBLISHED" } });

  await sendOrderPublishedEmail(
    order.customer.email,
    order.id,
    order.items.map((i) => ({ domain: i.websiteProduct.website.domain, liveUrl: i.placement!.liveUrl! }))
  );
}

// Queues (or, for a site without WP Sync, directly publishes) every
// customer-supplied item in an order, provided an admin has switched
// auto-publish on (Admin -> Instellingen) — off by default, since
// otherwise a customer's article goes live on a real site completely
// unreviewed the moment an order exists as PAID. Shared by fulfillPaidOrder
// (a real checkout) and the admin test-order tool (Admin -> Orders ->
// "+ Testorder aanmaken") — a test order should behave exactly like a real
// one from this point on, not need its own separate manual step.
//
// A homepage-link item (ProductType.HOMEPAGE_LINK — the startpagina
// feature) is exempt from the auto-publish gate above: it's just a
// category, anchor text and target URL, nothing an admin could meaningfully
// review, so it always queues immediately regardless of that setting.
export async function maybeAutoPublishOrder(orderId: string): Promise<void> {
  const autoPublishEnabled = await getAutoPublishEnabled();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { websiteProduct: { include: { website: true, product: true } } } } },
  });
  if (!order) return;

  for (const item of order.items) {
    const website = item.websiteProduct.website;

    if (item.websiteProduct.product.type === "HOMEPAGE_LINK") {
      if (item.targetUrl && item.anchorText && website.wpSyncSecret) {
        await prisma.orderItem.update({ where: { id: item.id }, data: { readyToPublish: true } });
      }
      continue;
    }

    if (!autoPublishEnabled) continue;

    // Diagnostic — pins down exactly which condition an order item fails,
    // since "autoPublish is on but nothing got queued" has no other way to
    // tell from the outside which check tripped.
    console.log(
      `maybeAutoPublishOrder check for item ${item.id}: contentSource=${item.contentSource} hasTitle=${Boolean(item.articleTitle)} hasBody=${Boolean(item.articleBody)} wpSyncSecret=${Boolean(website.wpSyncSecret)} directWpConfigured=${isWordPressConfigured(website)}`
    );
    if (item.contentSource === "CUSTOMER" && item.articleTitle && item.articleBody) {
      if (website.wpSyncSecret) {
        // Site pulls this itself on its next sync (see src/app/api/wp-sync/*
        // and wordpress-plugin/nugevonden-wp-sync.php) — nothing to push
        // here, just mark it as ready.
        await prisma.orderItem.update({ where: { id: item.id }, data: { readyToPublish: true } });
      } else if (isWordPressConfigured(website)) {
        try {
          const { liveUrl } = await publishToWordPress(website, {
            title: item.articleTitle,
            body: item.articleBody,
            targetUrl: item.targetUrl,
            anchorText: item.anchorText,
            imageKey: item.articleImageKey,
            wpTermId: item.wpTermId,
          });
          await prisma.placement.upsert({
            where: { orderItemId: item.id },
            create: { orderItemId: item.id, liveUrl, publishedAt: new Date(), status: "published" },
            update: { liveUrl, publishedAt: new Date(), status: "published" },
          });
        } catch (err) {
          // A publish failure here must not look like an overall failure to
          // the caller (the order already exists/is paid). Log loudly so an
          // admin can publish it manually from /admin/orders instead.
          console.error(`WordPress publish failed for order item ${item.id}`, err);
        }
      }
    }
  }
}

// Shared by the Stripe webhook and the admin reconciliation job — both
// paths land here once a checkout is confirmed paid, so there's exactly
// one place that marks an order PAID, creates its invoice, splits the
// payout across publishers, and sends the notification emails.
export async function fulfillPaidOrder(
  orderId: string,
  checkoutSessionId: string,
  paymentIntentId: string | null
): Promise<void> {
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
  // Idempotency: this can be called more than once for the same order
  // (a retried webhook delivery, or reconciliation re-checking a session
  // the webhook already handled) — only run the one-time side effects the
  // first time it actually leaves NEW.
  const alreadyProcessed = existingOrder?.status !== "NEW";

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.payment.updateMany({
      where: { orderId, providerRef: checkoutSessionId },
      data: { status: "paid", providerRef: paymentIntentId ?? checkoutSessionId },
    }),
  ]);

  if (alreadyProcessed) return;

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
  if (!order) return;

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

  // A cart can hold links from several publishers, so the charge went to
  // the platform in full (no transfer_data on the PaymentIntent) — split it
  // out per publisher now with separate Transfers, tied to the original
  // charge via source_transaction so it draws from those specific funds
  // rather than the platform's general balance.
  if (paymentIntentId) {
    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : undefined;

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
      // Payment already succeeded — a transfer failure must not look like
      // an overall failure to the caller (the webhook would get retried by
      // Stripe; reconciliation would re-run the whole thing). Log loudly so
      // an admin can create the transfer manually from the Stripe dashboard.
      console.error(`Publisher transfer(s) failed for order ${order.id}`, err);
    }
  }

  await maybeAutoPublishOrder(order.id);
  await finalizeOrderIfFullyPublished(order.id);

  await sendOrderConfirmationEmail(order.customer.email, order.id, domains, totalAmount);

  // Off while the platform only sells the operator's own sites — see the
  // matching flag in the cart checkout action.
  const publisherPayoutsEnabled = process.env.PUBLISHER_PAYOUTS_ENABLED === "true";
  if (publisherPayoutsEnabled) {
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
