import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, attentionEmail, riskEmail } from "@/lib/email";
import { getOrgMembers, getOrgPolicy, getUserAndOrg } from "@/lib/data";

type EmailRow = { email: string };

// Session-less attention alert for the webhook path. Takes an explicit org and a
// service-role client (no user session), reads the org's policy threshold and
// admins directly, and emails them when a re-scan crosses the threshold. Uses
// org_admin_emails (service-role only) rather than org_members, which is gated
// on the caller being a member (auth.uid()) and returns nothing for the webhook.
export async function notifyAttentionForOrg(
  db: SupabaseClient,
  orgId: string,
  repoName: string,
  aiPercent: number,
): Promise<void> {
  const { data: policy } = await db.from("org_policy").select("threshold").eq("org_id", orgId).maybeSingle();
  const threshold = Math.round(Number((policy?.threshold as number | string | undefined) ?? 0.4) * 100);
  if (aiPercent <= threshold) return;

  const [{ data: org }, { data: rows }] = await Promise.all([
    db.from("orgs").select("name").eq("id", orgId).maybeSingle(),
    db.rpc("org_admin_emails", { p_org: orgId }),
  ]);
  const admins = ((rows ?? []) as EmailRow[]).map((r) => r.email).filter(Boolean);
  if (admins.length === 0) return;

  const href = `https://getgrain.dev/app/repos/${encodeURIComponent(repoName)}`;
  const { subject, html } = attentionEmail((org?.name as string | undefined) ?? "your workspace", repoName, aiPercent, threshold, href);
  await sendEmail({ to: admins, subject, html });
}

// Session-less risk alert for the webhook path: when the commits that were just
// pushed put AI-written lines into a critical path with no review evidence,
// email the workspace's admins with the hotspots. Only the pushed commits
// count, so one push produces at most one alert.
export async function notifyRiskForOrg(
  db: SupabaseClient,
  orgId: string,
  repoName: string,
  risk: { top: { sha: string; subject: string; path: string; ai_lines: number }[] },
  pushedShas: string[],
): Promise<void> {
  if (pushedShas.length === 0) return;
  const pushed = new Set(pushedShas);
  const hot = risk.top.filter((h) => pushed.has(h.sha));
  if (hot.length === 0) return;
  const lines = hot.reduce((t, h) => t + h.ai_lines, 0);

  const [{ data: org }, { data: rows }] = await Promise.all([
    db.from("orgs").select("name").eq("id", orgId).maybeSingle(),
    db.rpc("org_admin_emails", { p_org: orgId }),
  ]);
  const admins = ((rows ?? []) as EmailRow[]).map((r) => r.email).filter(Boolean);
  if (admins.length === 0) return;

  const href = `https://getgrain.dev/app/repos/${encodeURIComponent(repoName)}`;
  const { subject, html } = riskEmail((org?.name as string | undefined) ?? "your workspace", repoName, lines, hot, href);
  await sendEmail({ to: admins, subject, html });
}

// After a Cloud scan, email the workspace's admins when a repo crosses the
// org policy's AI threshold. Best-effort and inert unless email is configured;
// callers wrap it so a notification failure never affects the scan result.
export async function notifyIfOverThreshold(repoName: string, aiPercent: number): Promise<void> {
  const policy = await getOrgPolicy();
  const threshold = Math.round((policy?.threshold ?? 0.4) * 100);
  if (aiPercent <= threshold) return;

  const [{ org }, members] = await Promise.all([getUserAndOrg(), getOrgMembers()]);
  const admins = members
    .filter((m) => m.role === "admin" || m.role === "owner")
    .map((m) => m.email)
    .filter(Boolean);
  if (admins.length === 0) return;

  const origin = (await headers()).get("origin") ?? "https://getgrain.dev";
  const href = `${origin}/app/repos/${encodeURIComponent(repoName)}`;
  const { subject, html } = attentionEmail(org?.name ?? "your workspace", repoName, aiPercent, threshold, href);
  await sendEmail({ to: admins, subject, html });
}
