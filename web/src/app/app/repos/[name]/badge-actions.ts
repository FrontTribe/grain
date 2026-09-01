"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

async function toggle(formData: FormData, enable: boolean) {
  const repoId = String(formData.get("repo_id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!repoId) return;
  const supabase = await createClient();
  await supabase.rpc("set_badge", { p_repo_id: repoId, p_enable: enable });
  revalidatePath(`/app/repos/${encodeURIComponent(name)}`);
}

export async function enableBadge(formData: FormData) {
  await toggle(formData, true);
}
export async function disableBadge(formData: FormData) {
  await toggle(formData, false);
}
