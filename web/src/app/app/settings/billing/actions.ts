"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getActiveOrgId } from "@/lib/data";
import { getStripe, PRICE_ID, stripeConfigured } from "@/lib/stripe";

async function origin(): Promise<string> {
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

// Start a Stripe Checkout session to subscribe the active org to the Team plan.
export async function startCheckout() {
  const base = await origin();
  if (!stripeConfigured()) redirect("/app/settings?tab=billing&billing=unconfigured");

  const supabase = await createClient();
  const [{ data: userData }, orgId] = await Promise.all([supabase.auth.getUser(), getActiveOrgId()]);
  const user = userData.user;
  if (!orgId || !user) redirect("/app/settings?tab=billing&billing=error");

  const { data: org } = await supabase.from("orgs").select("id,name,stripe_customer_id").eq("id", orgId).maybeSingle();
  if (!org) redirect("/app/settings?tab=billing&billing=error");

  let customerId = (org as { stripe_customer_id: string | null }).stripe_customer_id;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      name: (org as { name: string }).name,
      metadata: { org_id: orgId },
    });
    customerId = customer.id;
    await supabase.rpc("set_stripe_customer", { p_org: orgId, p_customer: customerId });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/app/settings?tab=billing&billing=success`,
    cancel_url: `${base}/app/settings?tab=billing&billing=cancelled`,
    metadata: { org_id: orgId },
    subscription_data: { metadata: { org_id: orgId } },
  });

  if (session.url) redirect(session.url);
  redirect("/app/settings?tab=billing&billing=error");
}

// Open the Stripe billing portal to manage an existing subscription.
export async function openPortal() {
  const base = await origin();
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/app/settings?tab=billing&billing=error");

  const { data: org } = await supabase.from("orgs").select("stripe_customer_id").eq("id", orgId).maybeSingle();
  const customerId = (org as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) redirect("/app/settings?tab=billing&billing=error");

  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/app/settings`,
  });
  redirect(portal.url);
}
