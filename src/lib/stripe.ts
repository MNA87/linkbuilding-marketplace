import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Lazy singleton: importing this module must never crash a build/dev-server
// boot just because Stripe keys aren't configured yet. The error only
// surfaces when a payment-related code path actually runs.
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY ontbreekt in de omgevingsvariabelen.");
  }
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
  return _stripe;
}
