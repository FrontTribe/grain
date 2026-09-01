// Server-side GitHub scan: fetch a repo's commit history via the REST API and
// classify DECLARED provenance signals (Co-Authored-By agent trailers, bot
// identities) — the same high-confidence signals grain's engine trusts. This is
// commit-weighted and declared-only (no line counts or directories from the API);
// `grain push` from the CLI remains the line-weighted, per-directory path.

const AGENTS = ["claude", "copilot", "cursor", "codex", "devin", "chatgpt", "gemini", "anthropic"];

export type GhReport = {
  schema: string;
  repo: string;
  generated_at: string;
  range: { commits: number };
  summary: { human: number; ai_assisted: number; unclassified: number; lines: number };
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

export class GithubScanError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

  let ai = 0;
  let human = 0;
  for (const c of commits) (isDeclaredAI(c) ? ai++ : human++);
  const total = Math.max(1, commits.length);

  const report: GhReport = {
    schema: "grain/v0.1",
    repo: `${owner}/${repo}`,
    generated_at: new Date().toISOString(),
    range: { commits: commits.length },
    summary: { human: human / total, ai_assisted: ai / total, unclassified: 0, lines: 0 },
    by_path: [],
  };
  return {
    report,
    human: Math.round((human / total) * 100),
    ai: Math.round((ai / total) * 100),
    commits: commits.length,
  };
}
