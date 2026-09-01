"use server";

import { revalidatePath } from "next/cache";
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

  let scan;
  try {
    scan = await scanGithubRepo(parsed.owner, parsed.repo, { max: 100 });
  } catch (e) {
    if (e instanceof GithubScanError) return { error: e.message };
    return { error: "Could not reach GitHub. Try again." };
  }

  const supabase = await createClient();
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
