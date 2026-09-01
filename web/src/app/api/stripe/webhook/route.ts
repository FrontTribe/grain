import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Service-role client: the webhook has no user session, so it writes with elevated
// privileges after the Stripe signature has been verified.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.org_id;
  const db = admin();
  // Newer Stripe API versions carry the period on each subscription item.
  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
  const patch = {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    plan: sub.status === "active" || sub.status === "trialing" ? "team" : "free",
  };
  if (orgId) {
    await db.from("orgs").update(patch).eq("id", orgId);
  } else {
    await db.from("orgs").update(patch).eq("stripe_customer_id", sub.customer as string);
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          if (!sub.metadata?.org_id && session.metadata?.org_id) {
            sub.metadata = { ...sub.metadata, org_id: session.metadata.org_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
