// Server-side GitHub scan: fetch a repo's commit history via the REST API and
// classify provenance across two tiers — DECLARED (Co-Authored-By agent
// trailers, bot identities: the high-confidence signals grain's engine trusts)
// and INFERRED (the content classifier run over each non-declared commit's diff,
// a capped estimate). `grain push` from the CLI remains the line-weighted,
// per-directory path; this is commit-weighted.

import { classifyDiff } from "@/lib/classify";

const AGENTS = ["claude", "copilot", "cursor", "codex", "devin", "chatgpt", "gemini", "anthropic"];

export type GhReport = {
  schema: string;
  repo: string;
  generated_at: string;
  range: { commits: number };
  summary: {
    human: number;
    ai_assisted: number;
    unclassified: number;
    lines: number;
    ai_by_basis: { attested: number; declared: number; inferred: number };
  };
  by_path: never[];
};

export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/,"");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
  return { owner, repo };
}

function truthy(v: string): boolean {
  return ["true", "yes", "1", "on"].includes(v.toLowerCase().trim());
}
function isAgent(s: string): boolean {
  const l = s.toLowerCase();
  return AGENTS.some((a) => l.includes(a));
}

type Commit = {
  sha?: string;
  commit?: { message?: string; author?: { name?: string; email?: string } };
  author?: { login?: string; type?: string } | null;
  committer?: { login?: string; type?: string } | null;
};

function botLike(u: { login?: string; type?: string } | null | undefined): boolean {
  if (!u) return false;
  if (u.type === "Bot") return true;
  return (u.login ?? "").toLowerCase().endsWith("[bot]");
}

// Faithful to internal/signal.Extract: declared AI from agent co-author/assisted
// trailers or a bot/agent identity. Everything else is treated as human.
export function isDeclaredAI(c: Commit): boolean {
  const msg = c.commit?.message ?? "";
  for (const raw of msg.split("\n")) {
    const line = raw.trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === "co-authored-by" && isAgent(v)) return true;
    if ((k === "generated-by" || k === "assisted-by") && (isAgent(v) || truthy(v))) return true;
    if (k === "ai-assisted" && truthy(v)) return true;
  }
  if (botLike(c.author) || botLike(c.committer)) return true;
  const nm = c.commit?.author?.name ?? "";
  const em = c.commit?.author?.email ?? "";
  if (isAgent(nm) || isAgent(em)) return true;
  return false;
}

export type GhRepo = { full_name: string; private: boolean; pushed_at: string | null };

// List the authenticated user's repositories (owner + collaborator + org),
// most-recently-pushed first. Requires a token with repo (or public_repo) scope.
export async function listUserRepos(token: string, max = 100): Promise<GhRepo[]> {
  const res = await fetch(
    `https://api.github.com/user/repos?per_page=${max}&sort=pushed&affiliation=owner,collaborator,organization_member`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "grain-cloud",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new GithubScanError(`Could not list repositories (${res.status}).`, res.status);
  const rows = (await res.json()) as Array<{ full_name: string; private: boolean; pushed_at: string | null }>;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({ full_name: r.full_name, private: r.private, pushed_at: r.pushed_at }));
}

export class GithubScanError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// --- inferred tier: fetch a commit's diff and classify its added lines ---

type CommitFile = { filename?: string; patch?: string; additions?: number };

// Extract added lines (without the leading '+') from a unified-diff patch,
// skipping the '+++' file header. Capped to keep memory bounded on big commits.
function addedLinesFromPatch(patch: string, cap = 4000): string[] {
  const out: string[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++")) continue;
    if (line.startsWith("+")) {
      out.push(line.slice(1));
      if (out.length >= cap) break;
    }
  }
  return out;
}

// Fetch one commit's files and return its added lines grouped by path. Returns
// null on any error so a single failed commit never aborts the scan.
async function fetchCommitAddedLines(
  owner: string,
  repo: string,
  sha: string,
  headers: Record<string, string>,
): Promise<Record<string, string[]> | null> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { files?: CommitFile[] };
    const files = body.files ?? [];
    const added: Record<string, string[]> = {};
    for (const f of files) {
      if (!f.filename || !f.patch) continue;
      const lines = addedLinesFromPatch(f.patch);
      if (lines.length > 0) added[f.filename] = lines;
    }
    return added;
  } catch {
    return null;
  }
}

// Run an async mapper over items with bounded concurrency (rate-limit friendly).
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function scanGithubRepo(
  owner: string,
  repo: string,
  opts: { token?: string; max?: number } = {},
): Promise<{ report: GhReport; human: number; ai: number; commits: number }> {
  const max = Math.min(100, opts.max ?? 100);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grain-cloud",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${max}`;
  const res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 404) {
    throw new GithubScanError("Repository not found (or private — connect a token for private repos).", 404);
  }
  if (res.status === 403 || res.status === 429) {
    throw new GithubScanError("GitHub API rate limit reached — try again in a few minutes.", 403);
  }
  if (!res.ok) {
    throw new GithubScanError(`GitHub API error (${res.status}).`, res.status);
  }

  const commits = (await res.json()) as Commit[];
  if (!Array.isArray(commits) || commits.length === 0) {
    throw new GithubScanError("No commits found on the default branch.", 422);
  }

  const total = Math.max(1, commits.length);
  const declaredFlags = commits.map(isDeclaredAI);
  const declaredCount = declaredFlags.filter(Boolean).length;

  // Inferred tier: run the content classifier over the diffs of the most recent
  // non-declared commits, then extrapolate the sampled AI-rate to all
  // non-declared commits. Bounded (and lower without a token) to respect rate
  // limits — each sampled commit is one extra API call.
  const deepMax = opts.token ? 40 : 12;
  const candidates = commits.filter((_, i) => !declaredFlags[i]).slice(0, deepMax);
  const diffs = await mapLimit(candidates, 5, (c) => fetchCommitAddedLines(owner, repo, c.sha ?? "", headers));
  let sampled = 0;
  let inferredInSample = 0;
  for (const d of diffs) {
    if (!d) continue; // fetch failed — don't let it bias the rate
    const { ai: isAI, ok } = classifyDiff(d);
    if (!ok) continue; // no substantive added code (deletions, binaries, config)
    sampled++;
    if (isAI) inferredInSample++;
  }

  const nonDeclared = total - declaredCount;
  const inferredRate = sampled > 0 ? inferredInSample / sampled : 0;
  const declaredFrac = declaredCount / total;
  const inferredFrac = inferredRate * (nonDeclared / total);
  const aiFrac = Math.min(1, declaredFrac + inferredFrac);
  const humanFrac = 1 - aiFrac;

  const report: GhReport = {
    schema: "grain/v0.1",
    repo: `${owner}/${repo}`,
    generated_at: new Date().toISOString(),
    range: { commits: commits.length },
    summary: {
      human: humanFrac,
      ai_assisted: aiFrac,
      unclassified: 0,
      lines: 0,
      ai_by_basis: { attested: 0, declared: declaredFrac, inferred: inferredFrac },
    },
    by_path: [],
  };
  return {
    report,
    human: Math.round(humanFrac * 100),
    ai: Math.round(aiFrac * 100),
    commits: commits.length,
  };
}
