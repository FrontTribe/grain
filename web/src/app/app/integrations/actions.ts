"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { parseRepoInput, scanGithubRepo, GithubScanError } from "@/lib/github";

export type ConnectState = {
  ok?: boolean;
  repo?: string;
  human?: number;
  ai?: number;
  commits?: number;
  error?: string;
};

export async function connectGithubRepo(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const parsed = parseRepoInput(String(formData.get("repo") ?? ""));
  if (!parsed) return { error: "Enter a repository as owner/name or a github.com URL." };

  const supabase = await createClient();
  // Use the stored GitHub token when present — enables private repos + higher rate limits.
  const { data: token } = await supabase.rpc("get_github_token");

  let scan;
  try {
    scan = await scanGithubRepo(parsed.owner, parsed.repo, { max: 100, token: token ?? undefined });
  } catch (e) {
    if (e instanceof GithubScanError) return { error: e.message };
    return { error: "Could not reach GitHub. Try again." };
  }

  const { error } = await supabase.rpc("ingest_grain_member", { p_payload: scan.report });
  if (error) {
    const noOrg = error.message?.includes("no org");
    return { error: noOrg ? "No workspace for your account." : error.message };
  }

  revalidatePath("/app");
  revalidatePath("/app/repos");
  return {
    ok: true,
    repo: `${parsed.owner}/${parsed.repo}`,
    human: scan.human,
    ai: scan.ai,
    commits: scan.commits,
  };
}

// Onboarding step 3: scan the repositories selected on /connect, then show
// the result on /onboarding. Bounded so a large selection can't hang the flow.
export async function onboardScan(formData: FormData) {
  const selected = formData.getAll("repo").map(String).filter(Boolean).slice(0, 10);
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("get_github_token");

  for (const full of selected) {
    const p = parseRepoInput(full);
    if (!p) continue;
    try {
      const scan = await scanGithubRepo(p.owner, p.repo, { token: token ?? undefined, max: 100 });
      await supabase.rpc("ingest_grain_member", { p_payload: scan.report });
    } catch {
      // one repo failing (rate limit, gone private) shouldn't abort onboarding
    }
  }
  revalidatePath("/app");
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

// Re-scan a repo already in the workspace by re-fetching it from GitHub.
export async function rescanRepo(formData: FormData) {
  const full = String(formData.get("full_name") ?? "");
  const name = String(formData.get("name") ?? "");
  const base = `/app/repos/${encodeURIComponent(name)}`;
  const p = parseRepoInput(full);
  if (!p) redirect(`${base}?error=${encodeURIComponent("This repo has no GitHub source to re-scan.")}`);

  const supabase = await createClient();
  const { data: token } = await supabase.rpc("get_github_token");
  let err = "";
  try {
    const scan = await scanGithubRepo(p.owner, p.repo, { token: token ?? undefined, max: 100 });
    await supabase.rpc("ingest_grain_member", { p_payload: scan.report });
  } catch (e) {
    err = e instanceof GithubScanError ? e.message : "Re-scan failed — try again.";
  }
  revalidatePath(base);
  revalidatePath("/app");
  redirect(err ? `${base}?error=${encodeURIComponent(err)}` : `${base}?rescanned=1`);
}

export async function disconnectGithub() {
  const supabase = await createClient();
  await supabase.rpc("disconnect_github");
  revalidatePath("/app/settings");
}
