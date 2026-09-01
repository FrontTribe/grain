"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function updateOrgPolicy(formData: FormData) {
  const threshold = Number(formData.get("threshold") ?? 40) / 100;
  const floor = Number(formData.get("floor") ?? 50) / 100;
  const enforcement = String(formData.get("enforcement") ?? "comment");
  const paths = formData
    .getAll("path")
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_policy", {
    p_threshold: threshold,
    p_floor: floor,
    p_enforcement: enforcement,
    p_human_owned: paths,
  });

  revalidatePath("/app/policy");
  revalidatePath("/app");
  redirect(error ? `/app/policy?error=${encodeURIComponent(error.message)}` : "/app/policy?saved=1");
}
