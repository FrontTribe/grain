"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function signInWithGithub(formData?: FormData) {
  const next = String(formData?.get("next") ?? "");
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const nextQ = next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback${nextQ}` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

// Elevated GitHub authorization (repo scope) so the dashboard can list & scan
// private repositories. The callback captures the provider_token and stores it.
export async function connectGithub(formData?: FormData) {
  const next = String(formData?.get("next") ?? "/app/settings") || "/app/settings";
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes: "read:user repo",
      redirectTo: `${origin}/auth/callback?connect=1&next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`${next}?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

export async function login(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    const q = next ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=${encodeURIComponent(error.message)}${q}`);
  }
  revalidatePath("/app", "layout");
  redirect(next && next.startsWith("/") ? next : "/app");
}

export async function signup(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  const nextQ = next && next.startsWith("/") ? `&next=${encodeURIComponent(next)}` : "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: { data: { full_name: String(formData.get("name") ?? "") } },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}${nextQ}`);
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm, then sign in.")}${nextQ}`);
  }
  revalidatePath("/app", "layout");
  redirect(next && next.startsWith("/") ? next : "/connect");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
