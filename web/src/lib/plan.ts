// Plan gating. Free workspaces are capped; a Team subscription lifts the caps.
// Enforced server-side in the connect and invite actions, surfaced in Settings.
import { getUserAndOrg } from "@/lib/data";

export const FREE_LIMITS = { repos: 3, seats: 3 };

export function isSubscribed(status?: string | null): boolean {
  return status === "active" || status === "trialing";
}

// Whether the active workspace has a live Team subscription.
export async function planSubscribed(): Promise<boolean> {
  const { org } = await getUserAndOrg();
  const status = (org as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  return isSubscribed(status);
}
