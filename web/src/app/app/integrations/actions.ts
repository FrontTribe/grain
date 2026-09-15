"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { parseRepoInput, scanGithubRepo, GithubScanError, TOKEN_REJECTED } from "@/lib/github";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRepos } from "@/lib/data";
import { planSubscribed, FREE_LIMITS } from "@/lib/plan";
import { notifyIfOverThreshold } from "@/lib/notify";

export type ConnectState = {
  ok?: boolean;
  repo?: string;
  human?: number;
  ai?: number;
  commits?: number;
  error?: string;
  reconnect?: boolean; // the stored GitHub token was rejected during this request
};

// Scan with the user's stored GitHub token. When GitHub rejects the token
// (401) the connection is marked invalid, the scan is retried without a token
// (public repos still work, at the lower rate limit) and `reconnect` is set so
// the caller can point at Settings. A private repo then fails with the
// reconnect message rather than a bare 401.
async function scanForUser(supabase: SupabaseClient, owner: string, repo: string) {
  const { data: token } = await supabase.rpc("get_github_token");
  try {
    return { scan: await scanGithubRepo(owner, repo, { token: token ?? undefined, max: 100 }), reconnect: false };
  } catch (e) {
    if (!(e instanceof GithubScanError && e.status === 401 && token)) throw e;
    await supabase.rpc("invalidate_github_token");
    try {
      return { scan: await scanGithubRepo(owner, repo, { max: 100 }), reconnect: true };
    } catch (e2) {
      if (e2 instanceof GithubScanError && e2.status === 404) throw new GithubScanError(TOKEN_REJECTED, 401);
      throw e2;
    }
  }
}

export async function connectGithubRepo(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const parsed = parseRepoInput(String(formData.get("repo") ?? ""));
  if (!parsed) return { error: "Enter a repository as owner/name or a github.com URL." };

  // Plan gate: free workspaces cap the number of repositories. Re-scanning one
  // that's already connected is always allowed.
  if (!(await planSubscribed())) {
    const existing = await getRepos();
    const already = existing.some((r) => r.full_name === `${parsed.owner}/${parsed.repo}` || r.name === parsed.repo);
    if (!already && existing.length >= FREE_LIMITS.repos) {
      return { error: `Free workspaces include ${FREE_LIMITS.repos} repositories. Upgrade to Team for unlimited.` };
    }
  }

  const supabase = await createClient();
  // The stored GitHub token enables private repos and higher rate limits.
  let scan;
  let reconnect = false;
  try {
    ({ scan, reconnect } = await scanForUser(supabase, parsed.owner, parsed.repo));
  } catch (e) {
    if (e instanceof GithubScanError) return { error: e.message, reconnect: e.status === 401 };
    return { error: "Could not reach GitHub. Try again." };
  }

  const { error } = await supabase.rpc("ingest_grain_member", { p_payload: scan.report });
  if (error) {
    const noOrg = error.message?.includes("no org");
    return { error: noOrg ? "No workspace for your account." : error.message };
  }

  try { await notifyIfOverThreshold(parsed.repo, scan.ai); } catch { /* best-effort */ }

  revalidatePath("/app");
  revalidatePath("/app/repos");
  return {
    ok: true,
    repo: `${parsed.owner}/${parsed.repo}`,
    human: scan.human,
    ai: scan.ai,
    commits: scan.commits,
    reconnect,
  };
}

// Onboarding step 3: scan the repositories selected on /connect, then show
// the result on /onboarding. Bounded so a large selection can't hang the flow.
export async function onboardScan(formData: FormData) {
  let selected = formData.getAll("repo").map(String).filter(Boolean).slice(0, 10);
  const supabase = await createClient();

  // Plan gate: don't scan past the free repository cap.
  if (!(await planSubscribed())) {
    const remaining = Math.max(0, FREE_LIMITS.repos - (await getRepos()).length);
    selected = selected.slice(0, remaining);
  }

  for (const full of selected) {
    const p = parseRepoInput(full);
    if (!p) continue;
    try {
      const { scan } = await scanForUser(supabase, p.owner, p.repo);
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
  let err = "";
  let reconnect = false;
  let scanned = false;
  try {
    const r = await scanForUser(supabase, p.owner, p.repo);
    reconnect = r.reconnect;
    await supabase.rpc("ingest_grain_member", { p_payload: r.scan.report });
    scanned = true;
    try { await notifyIfOverThreshold(p.repo, r.scan.ai); } catch { /* best-effort */ }
  } catch (e) {
    if (e instanceof GithubScanError && e.status === 401) reconnect = true;
    else err = e instanceof GithubScanError ? e.message : "Re-scan failed. Try again.";
  }
  revalidatePath(base);
  revalidatePath("/app");
  // ?rescanned=1 on success; ?reconnect=rescanned when the token was rejected
  // but the public repo scanned anyway; ?reconnect=1 when nothing could be
  // scanned without it; ?error= for everything else.
  const q = new URLSearchParams();
  if (err) q.set("error", err);
  else if (scanned && !reconnect) q.set("rescanned", "1");
  if (reconnect) q.set("reconnect", scanned ? "rescanned" : "1");
  redirect(`${base}?${q.toString()}`);
}

export async function disconnectGithub() {
  const supabase = await createClient();
  await supabase.rpc("disconnect_github");
  revalidatePath("/app/settings");
}
