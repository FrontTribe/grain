"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type CreateTokenState = { token?: string; error?: string };

export async function createIngestToken(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const name = String(formData.get("name") ?? "").trim() || "CI token";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ingest_token", { p_name: name });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { token: data as string };
}

export async function revokeIngestToken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.rpc("revoke_ingest_token", { p_id: id });
  revalidatePath("/app/settings");
}
