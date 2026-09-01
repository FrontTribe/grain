"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function setRepoPolicy(formData: FormData) {
  const repoId = String(formData.get("repo_id") ?? "");
  const name = String(formData.get("name") ?? "");
  const threshold = Number(formData.get("threshold") ?? 40) / 100;
  const floor = Number(formData.get("floor") ?? 50) / 100;
  const enforcement = String(formData.get("enforcement") ?? "comment");
  const base = `/app/repos/${encodeURIComponent(name)}`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_repo_policy", {
    p_repo_id: repoId,
    p_threshold: threshold,
    p_floor: floor,
    p_enforcement: enforcement,
  });
  revalidatePath(base);
  revalidatePath("/app/policy");
  redirect(error ? `${base}?error=${encodeURIComponent(error.message)}` : `${base}?policy=saved`);
}

export async function clearRepoPolicy(formData: FormData) {
  const repoId = String(formData.get("repo_id") ?? "");
  const name = String(formData.get("name") ?? "");
  const base = `/app/repos/${encodeURIComponent(name)}`;

  const supabase = await createClient();
  await supabase.rpc("clear_repo_policy", { p_repo_id: repoId });
  revalidatePath(base);
  revalidatePath("/app/policy");
  redirect(`${base}?policy=cleared`);
}
