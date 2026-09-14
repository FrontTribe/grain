import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, attentionEmail, riskEmail, securityEmail } from "@/lib/email";
import type { Security, Dependencies } from "@/lib/data";
import { getOrgMembers, getOrgPolicy, getUserAndOrg } from "@/lib/data";
import { orgSubscribed, planSubscribed } from "@/lib/plan";

// Email alerts are a Team feature: every notifier checks the plan first and
// stays silent on Free (the dashboard still shows everything).

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
  if (!(await orgSubscribed(db, orgId))) return;
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
  if (!(await orgSubscribed(db, orgId))) return;
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

// Session-less security alert for the webhook path: AI-written security
// findings and unknown or young AI-added packages in the commits that were
// just pushed, in one email. Only the pushed commits count, so one push
// produces at most one alert; a clean push produces none.
export async function notifySecurityForOrg(
  db: SupabaseClient,
  orgId: string,
  repoName: string,
  security: Security | null | undefined,
  dependencies: Dependencies | null | undefined,
  pushedShas: string[],
): Promise<void> {
  if (pushedShas.length === 0) return;
  const pushed = new Set(pushedShas);
  const findings = (security?.findings ?? []).filter((f) => f.ai && pushed.has(f.sha));
  const deps = (dependencies?.deps ?? []).filter(
    (d) => d.checked && pushed.has(d.sha) && (!d.exists || (d.ai && d.age_days >= 0 && d.age_days < 30)),
  );
  if (findings.length === 0 && deps.length === 0) return;
  if (!(await orgSubscribed(db, orgId))) return;

  const [{ data: org }, { data: rows }] = await Promise.all([
    db.from("orgs").select("name").eq("id", orgId).maybeSingle(),
    db.rpc("org_admin_emails", { p_org: orgId }),
  ]);
  const admins = ((rows ?? []) as EmailRow[]).map((r) => r.email).filter(Boolean);
  if (admins.length === 0) return;

  const href = `https://getgrain.dev/app/repos/${encodeURIComponent(repoName)}`;
  const { subject, html } = securityEmail((org?.name as string | undefined) ?? "your workspace", repoName, findings, deps, href);
  await sendEmail({ to: admins, subject, html });
}

// After a Cloud scan, email the workspace's admins when a repo crosses the
// org policy's AI threshold. Best-effort and inert unless email is configured;
// callers wrap it so a notification failure never affects the scan result.
export async function notifyIfOverThreshold(repoName: string, aiPercent: number): Promise<void> {
  if (!(await planSubscribed())) return;
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
