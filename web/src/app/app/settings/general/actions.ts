"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function renameWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_org", { p_name: name });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  redirect(error ? `/app/settings?error=${encodeURIComponent(error.message)}` : "/app/settings?saved=1");
}
