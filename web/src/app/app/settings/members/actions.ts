"use server";

import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getActiveOrgId } from "@/lib/data";

export type InviteState = { link?: string; email?: string; error?: string };

export async function createInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "member");
  if (!email) return { error: "Enter an email address." };

  const orgId = await getActiveOrgId();
  if (!orgId) return { error: "No active workspace." };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invite", {
    p_org: orgId,
    p_email: email,
    p_role: role,
  });
  if (error) return { error: error.message };

  const origin = (await headers()).get("origin") ?? "";
  revalidatePath("/app/settings");
  return { link: `${origin}/invite/${token}`, email };
}

export async function revokeInvite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.rpc("revoke_invite", { p_id: id });
  revalidatePath("/app/settings");
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  const orgId = (data as { org_id?: string } | null)?.org_id;
  if (orgId) {
    (await cookies()).set("grain_org", orgId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}
