import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { listUserRepos, type GhRepo } from "@/lib/github";

// RLS keeps a user to their own orgs, but a user can belong to several (e.g. after
// accepting an invite). The active org is a cookie; every query is scoped to it.

export type OrgRow = { org_id: string; name: string; slug: string; role: string };

export const getMyOrgs = cache(async (): Promise<OrgRow[]> => {
  const s = await createClient();
  const { data } = await s.rpc("my_orgs");
  return (data as OrgRow[]) ?? [];
});

// Resolve the active org id: the cookie if it names an org the user is in, else the first.
export const getActiveOrgId = cache(async (): Promise<string | null> => {
  const orgs = await getMyOrgs();
  if (orgs.length === 0) return null;
  const pref = (await cookies()).get("grain_org")?.value;
  if (pref && orgs.some((o) => o.org_id === pref)) return pref;
  return orgs[0].org_id;
});

export type Member = { user_id: string; email: string; name: string; role: string; joined_at: string };

export async function getOrgMembers(): Promise<Member[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s.rpc("org_members", { p_org: orgId });
  return (data as Member[]) ?? [];
}

export type Invite = { id: string; email: string; role: string; token: string; created_at: string };

export async function getInvites(): Promise<Invite[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s
    .from("invites")
    .select("id,email,role,token,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data as Invite[]) ?? [];
}

export type Repo = {
  id: string; name: string; full_name: string | null;
  human: number; ai: number; unc: number;
  status: "healthy" | "attention"; human_owned: string[]; last_scan_at: string | null;
};
export type ScanRow = { human: number; ai: number; unc: number; commits: number; created_at: string };
export type EventRow = { id: string; kind: string; title: string; subtitle: string | null; repo: string | null; pr: number | null; ai: number | null; created_at: string };

export async function getUserAndOrg() {
  const s = await createClient();
  const [{ data: userData }, orgId] = await Promise.all([s.auth.getUser(), getActiveOrgId()]);
  const { data: org } = orgId
    ? await s.from("orgs").select("id,name,slug,plan,subscription_status,current_period_end").eq("id", orgId).maybeSingle()
    : { data: null };
  return { user: userData.user, org };
}

export async function getRepos(): Promise<Repo[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s.from("repos").select("*").eq("org_id", orgId).order("last_scan_at", { ascending: false, nullsFirst: false });
  return (data as Repo[]) ?? [];
}

export async function getOrgScans(): Promise<ScanRow[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s.from("scans").select("human,ai,unc,commits,created_at").eq("org_id", orgId).is("repo_id", null).order("created_at", { ascending: true });
  return (data as ScanRow[]) ?? [];
}

export async function getEvents(): Promise<EventRow[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s.from("events").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return (data as EventRow[]) ?? [];
}

export type IngestToken = {
  id: string; name: string; token_prefix: string;
  created_at: string; last_used_at: string | null;
};

export async function getIngestTokens(): Promise<IngestToken[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s
    .from("ingest_tokens")
    .select("id,name,token_prefix,created_at,last_used_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data as IngestToken[]) ?? [];
}

export type GithubConn = { github_login: string | null; connected_at: string } | null;

export async function getGithubConnection(): Promise<GithubConn> {
  const s = await createClient();
  const { data } = await s.rpc("github_connection_info");
  const row = Array.isArray(data) ? data[0] : null;
  return (row as GithubConn) ?? null;
}

export async function getGithubRepos(): Promise<GhRepo[]> {
  const s = await createClient();
  const { data: token } = await s.rpc("get_github_token");
  if (!token) return [];
  try {
    return await listUserRepos(token as string, 100);
  } catch {
    return [];
  }
}

export async function getOrgPolicy() {
  const orgId = await getActiveOrgId();
  if (!orgId) return null;
  const s = await createClient();
  const { data } = await s.from("org_policy").select("*").eq("org_id", orgId).maybeSingle();
  return data as { threshold: number; confidence_floor: number; enforcement: string; human_owned: string[] } | null;
}

export async function getRepoPolicies() {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s.from("repo_policies").select("repo_id,threshold,enforcement,floor,paths,repos(name)").eq("org_id", orgId).order("threshold", { ascending: true });
  return (data ?? []) as unknown as { repo_id: string; threshold: number; enforcement: string; floor: number; paths: number; repos: { name: string } | null }[];
}

export type DirRow = { path: string; human: number; ai: number; owned: boolean; lines: number };
export type PrRow = { number: number; title: string; ai: number; created_at: string };

export type RepoPolicy = { threshold: number; enforcement: string; floor: number } | null;

export async function getRepoDetail(name: string) {
  const orgId = await getActiveOrgId();
  if (!orgId) return null;
  const s = await createClient();
  const { data: repo } = await s.from("repos").select("*").eq("org_id", orgId).eq("name", name).maybeSingle();
  if (!repo) return null;
  const [{ data: dirs }, { data: prs }, { data: policy }, { data: org }] = await Promise.all([
    s.from("repo_dirs").select("path,human,ai,owned,lines").eq("repo_id", (repo as Repo).id).order("position", { ascending: true }),
    s.from("pull_requests").select("number,title,ai,created_at").eq("repo_id", (repo as Repo).id).order("created_at", { ascending: false }),
    s.from("repo_policies").select("threshold,enforcement,floor").eq("repo_id", (repo as Repo).id).maybeSingle(),
    s.from("org_policy").select("threshold,enforcement,confidence_floor").eq("org_id", orgId).maybeSingle(),
  ]);
  return {
    repo: repo as Repo,
    dirs: (dirs as DirRow[]) ?? [],
    prs: (prs as PrRow[]) ?? [],
    policy: (policy as RepoPolicy) ?? null,
    orgPolicy: (org as { threshold: number; enforcement: string; confidence_floor: number } | null) ?? null,
  };
}

// Org authorship trend: per-repo scans aggregated by month (averaged).
export async function getOrgTrend(): Promise<{ month: string; human: number; ai: number }[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const { data } = await s
    .from("scans")
    .select("human,ai,created_at")
    .eq("org_id", orgId)
    .not("repo_id", "is", null)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { human: number; ai: number; created_at: string }[];
  const byMonth = new Map<string, { h: number; a: number; n: number; label: string }>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { h: 0, a: 0, n: 0, label: d.toLocaleString("en-US", { month: "short" }) };
    cur.h += Number(r.human); cur.a += Number(r.ai); cur.n += 1;
    byMonth.set(key, cur);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ month: v.label, human: Math.round(v.h / v.n), ai: Math.round(v.a / v.n) }));
}

export type RepoTrend = { id: string; name: string; owner: string; ai: number; series: number[]; delta: number };

export async function getRepoTrends(): Promise<RepoTrend[]> {
  const orgId = await getActiveOrgId();
  if (!orgId) return [];
  const s = await createClient();
  const [{ data: repos }, { data: scans }] = await Promise.all([
    s.from("repos").select("id,name,full_name,ai").eq("org_id", orgId).order("ai", { ascending: false }),
    s.from("scans").select("repo_id,ai,created_at").eq("org_id", orgId).not("repo_id", "is", null).order("created_at", { ascending: true }),
  ]);
  const hist = new Map<string, number[]>();
  for (const sc of (scans ?? []) as { repo_id: string; ai: number }[]) {
    (hist.get(sc.repo_id) ?? hist.set(sc.repo_id, []).get(sc.repo_id)!).push(Math.round(Number(sc.ai)));
  }
  return ((repos ?? []) as Repo[]).map((r) => {
    const pct = hist.get(r.id) ?? [Math.round(Number(r.ai))]; // AI %, oldest → newest
    const delta = pct.length > 1 ? pct[pct.length - 1] - pct[0] : 0;
    const fractions = (pct.length > 1 ? pct : [pct[0], pct[0]]).map((v) => v / 100); // Spark wants 0..1
    return {
      id: r.id,
      name: r.name,
      owner: r.full_name?.split("/")[0] ?? "",
      ai: Math.round(Number(r.ai)),
      series: fractions,
      delta,
    };
  });
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
