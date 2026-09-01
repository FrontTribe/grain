import { createClient } from "@/utils/supabase/server";

// RLS scopes every table to the signed-in user's org, so we don't filter by org_id.

export type Repo = {
  id: string; name: string; full_name: string | null;
  human: number; ai: number; unc: number;
  status: "healthy" | "attention"; human_owned: string[]; last_scan_at: string | null;
};
export type ScanRow = { human: number; ai: number; unc: number; commits: number; created_at: string };
export type EventRow = { id: string; kind: string; title: string; subtitle: string | null; repo: string | null; pr: number | null; ai: number | null; created_at: string };

export async function getUserAndOrg() {
  const s = await createClient();
  const [{ data: userData }, { data: org }] = await Promise.all([
    s.auth.getUser(),
    s.from("orgs").select("id,name,slug,plan").limit(1).maybeSingle(),
  ]);
  return { user: userData.user, org };
}

export async function getRepos(): Promise<Repo[]> {
  const s = await createClient();
  const { data } = await s.from("repos").select("*").order("last_scan_at", { ascending: false, nullsFirst: false });
  return (data as Repo[]) ?? [];
}

export async function getOrgScans(): Promise<ScanRow[]> {
  const s = await createClient();
  const { data } = await s.from("scans").select("human,ai,unc,commits,created_at").is("repo_id", null).order("created_at", { ascending: true });
  return (data as ScanRow[]) ?? [];
}

export async function getEvents(): Promise<EventRow[]> {
  const s = await createClient();
  const { data } = await s.from("events").select("*").order("created_at", { ascending: false });
  return (data as EventRow[]) ?? [];
}

export async function getOrgPolicy() {
  const s = await createClient();
  const { data } = await s.from("org_policy").select("*").maybeSingle();
  return data as { threshold: number; confidence_floor: number; enforcement: string; human_owned: string[] } | null;
}

export async function getRepoPolicies() {
  const s = await createClient();
  const { data } = await s.from("repo_policies").select("repo_id,threshold,enforcement,floor,paths,repos(name)").order("threshold", { ascending: true });
  return (data ?? []) as unknown as { repo_id: string; threshold: number; enforcement: string; floor: number; paths: number; repos: { name: string } | null }[];
}

// ---- shaping helpers ----

export function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short" });
}

export function num(v: number): number {
  return Math.round(Number(v));
}
