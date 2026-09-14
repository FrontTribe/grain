import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, attentionEmail } from "@/lib/email";
import { getOrgMembers, getOrgPolicy, getUserAndOrg } from "@/lib/data";

type MemberRow = { email: string; role: string };

// Session-less attention alert for the webhook path. Takes an explicit org and a
// service-role client (no user session), reads the org's policy threshold and
// admins directly, and emails them when a re-scan crosses the threshold.
export async function notifyAttentionForOrg(
  db: SupabaseClient,
  orgId: string,
  repoName: string,
  aiPercent: number,
): Promise<void> {
  const { data: policy } = await db.from("org_policy").select("threshold").eq("org_id", orgId).maybeSingle();
  const threshold = Math.round(((policy?.threshold as number | undefined) ?? 0.4) * 100);
  if (aiPercent <= threshold) return;

  const [{ data: org }, { data: members }] = await Promise.all([
    db.from("orgs").select("name").eq("id", orgId).maybeSingle(),
    db.rpc("org_members", { p_org: orgId }),
  ]);
  const admins = ((members ?? []) as MemberRow[])
    .filter((m) => m.role === "admin" || m.role === "owner")
    .map((m) => m.email)
    .filter(Boolean);
  if (admins.length === 0) return;

  const href = `https://getgrain.dev/app/repos/${encodeURIComponent(repoName)}`;
  const { subject, html } = attentionEmail((org?.name as string | undefined) ?? "your workspace", repoName, aiPercent, threshold, href);
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
