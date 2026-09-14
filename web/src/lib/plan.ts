// Plan gating. Free workspaces are capped and skip the two things teams pay
// for (email alerts, the signed authorship export); a Team subscription lifts
// all of it. Enforced server-side (connect, invite, notify, export), surfaced
// in Settings and on the landing page.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserAndOrg } from "@/lib/data";

export const FREE_LIMITS = { repos: 3, seats: 3 };
export const TEAM_SEATS = 20;
export const TEAM_PRICE_USD = 29;

// What each plan includes, in the words the UI uses. One source for Settings
// and the landing page so they never drift.
export const PLAN_FEATURES = {
  free: [
    `${FREE_LIMITS.repos} repositories, ${FREE_LIMITS.seats} seats`,
    "CLI, GitHub Action, PR check",
    "Dashboard, scans on push, Risk and Outcomes",
    "Everything in the CLI, always",
  ],
  team: [
    `Unlimited repositories, up to ${TEAM_SEATS} seats`,
    "Email alerts: threshold crossings and unreviewed AI code in critical paths",
    "Signed authorship report (Bill of Materials) export",
    "Everything in Free",
  ],
  audit: [
    "Unlimited seats",
    "Retention rules and audit exports",
    "SSO on request, invoicing, priority support",
    "Everything in Team",
  ],
} as const;

export function isSubscribed(status?: string | null): boolean {
  return status === "active" || status === "trialing";
}

// Whether the active workspace has a live Team subscription (session path).
export async function planSubscribed(): Promise<boolean> {
  const { org } = await getUserAndOrg();
  const status = (org as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  return isSubscribed(status);
}

// Same check for session-less paths (webhooks) that already hold a
// service-role client and an explicit org id.
export async function orgSubscribed(db: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await db.from("orgs").select("subscription_status").eq("id", orgId).maybeSingle();
  return isSubscribed((data as { subscription_status?: string | null } | null)?.subscription_status);
}
