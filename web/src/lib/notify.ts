import { headers } from "next/headers";
import { sendEmail, attentionEmail } from "@/lib/email";
import { getOrgMembers, getOrgPolicy, getUserAndOrg } from "@/lib/data";

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
