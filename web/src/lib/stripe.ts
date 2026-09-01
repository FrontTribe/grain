import Stripe from "stripe";

// Lazily constructed so a missing key doesn't crash the build (routes are
// statically analysed with no env). Throws only when actually used unconfigured.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && PRICE_ID);
}
