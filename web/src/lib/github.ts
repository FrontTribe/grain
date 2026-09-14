// Server-side GitHub scan: fetch a repo's commit history via the REST API and
// classify provenance across all three tiers — ATTESTED (a grain git note on
// refs/notes/grain, authoritative), DECLARED (Co-Authored-By agent trailers, bot
// identities), and INFERRED (the content classifier over each remaining commit's
// diff, a capped estimate). `grain push` from the CLI remains the line-weighted,
// per-directory path; this is commit-weighted.

import { classifyDiff } from "@/lib/classify";
import { computeCloudRisk, parseAIHashes, type CloudRisk, type CloudRiskCommit } from "@/lib/risk";
import { verifyNoteSignature, type NoteSignature } from "@/lib/signing";

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
  by_path: { path: string; human: number; ai: number; lines: number; human_owned: boolean }[];
  risk?: CloudRisk;
  // attestation notes found, by signature status (docs/spec/provenance-v1.md)
  attestations?: { signed: number; unsigned: number; invalid: number };
};

// Top-level directory of a path; root-level files group under "(root)".
function topDir(path: string): string {
  const i = path.indexOf("/");
  return i < 0 ? "(root)" : path.slice(0, i);
}

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
  commit?: {
    message?: string;
    author?: { name?: string; email?: string };
    committer?: { name?: string; email?: string };
  };
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

// --- attested tier: read grain's git notes (refs/notes/grain) ---

type Attested = "ai" | "human";
// A parsed grain note: the class plus, when `grain attest` recorded AI-Lines: n/m,
// the exact share of added lines that were AI-written (-1 = whole-commit) and
// the hashes of those lines (for per-file attribution).
type AttestedNote = { cls: Attested; frac: number; hashes: Set<string> | null; sig: NoteSignature };

// Share of a commit that counts as AI: the attested line share when known,
// else the whole commit.
function attestedShare(n: AttestedNote | undefined): number {
  return n && n.frac >= 0 && n.frac < 1 ? n.frac : 1;
}

// Parse "AI-Lines: n/m" from a grain note into a fraction, or -1 when absent.
function parseAILineFrac(note: string): number {
  for (const raw of note.split("\n")) {
    const line = raw.trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    if (line.slice(0, idx).trim().toLowerCase() !== "ai-lines") continue;
    const [n, m] = line.slice(idx + 1).split("/").map((s) => Number(s.trim()));
    if (Number.isFinite(n) && Number.isFinite(m) && m > 0 && n >= 0 && n <= m) return n / m;
  }
  return -1;
}

// Parse a git note body into an authoritative class. Faithful to
// internal/signal's note handling; the last recognized line wins.
function parseAttestedClass(note: string): Attested | "" {
  let cls: Attested | "" = "";
  for (const raw of note.split("\n")) {
    const line = raw.trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    const lv = v.toLowerCase();
    switch (k) {
      case "provenance":
        if (["ai", "ai-authored", "ai_authored", "assisted", "ai-assisted"].includes(lv)) cls = "ai";
        else if (["human", "human-authored", "manual"].includes(lv)) cls = "human";
        break;
      case "ai-authored": {
        if (truthy(v)) cls = "ai";
        else {
          const f = Number(v);
          if (!Number.isNaN(f) && v !== "") cls = f > 0.5 ? "ai" : "human";
        }
        break;
      }
      case "human-authored":
        if (truthy(v)) cls = "human";
        break;
      case "co-authored-by":
      case "generated-by":
      case "assisted-by":
        if (isAgent(v) || truthy(v)) cls = "ai";
        break;
      case "ai-assisted":
        if (truthy(v)) cls = "ai";
        break;
    }
  }
  return cls;
}

// Fetch attested provenance notes for the given commit SHAs. Walks the
// refs/notes/grain ref → notes commit → tree, then reads a blob only for the
// commits that actually carry a note. Returns an empty map when the ref is
// absent (most repos) or on any error.
async function fetchAttestedNotes(
  owner: string,
  repo: string,
  commitShas: string[],
  headers: Record<string, string>,
): Promise<Map<string, AttestedNote>> {
  const result = new Map<string, AttestedNote>();
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
    return res.ok ? res.json() : null;
  };
  try {
    const ref = await get(`/git/ref/notes/grain`);
    const notesCommit = ref?.object?.sha;
    if (!notesCommit) return result;
    const commit = await get(`/git/commits/${notesCommit}`);
    const treeSha = commit?.tree?.sha;
    if (!treeSha) return result;
    const tree = await get(`/git/trees/${treeSha}?recursive=1`);
    const wanted = new Set(commitShas);
    const blobByCommit = new Map<string, string>();
    for (const e of (tree?.tree ?? []) as { path?: string; type?: string; sha?: string }[]) {
      if (e.type !== "blob" || !e.path || !e.sha) continue;
      const sha = e.path.replace(/\//g, ""); // notes trees fan out as ab/cdef…
      if (wanted.has(sha)) blobByCommit.set(sha, e.sha);
    }
    await mapLimit([...blobByCommit.entries()], 5, async ([commitSha, blobSha]) => {
      const blob = await get(`/git/blobs/${blobSha}`);
      if (!blob) return null;
      const text = blob.encoding === "base64" ? Buffer.from(String(blob.content), "base64").toString("utf8") : String(blob.content ?? "");
      const cls = parseAttestedClass(text);
      // A note whose signature fails is kept only to be counted: it claims a
      // key and doesn't verify, so it was altered or moved — never trusted.
      if (cls) result.set(commitSha, { cls, frac: parseAILineFrac(text), hashes: parseAIHashes(text), sig: verifyNoteSignature(commitSha, text).status });
      return null;
    });
  } catch {
    return result;
  }
  return result;
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
  const shas = commits.map((c) => c.sha ?? "");
  const declaredFlags = commits.map(isDeclaredAI);

  // Attested provenance from grain's git notes is authoritative when present.
  const attested = await fetchAttestedNotes(owner, repo, shas.filter(Boolean), headers);
  const attestations = { signed: 0, unsigned: 0, invalid: 0 };
  for (const n of attested.values()) {
    if (n.sig === "valid") attestations.signed++;
    else if (n.sig === "invalid") attestations.invalid++;
    else attestations.unsigned++;
  }
  const basisOf = (i: number): "attested-ai" | "attested-human" | "declared" | "infer" => {
    const n = attested.get(shas[i]);
    const cls = n && n.sig !== "invalid" ? n.cls : undefined;
    if (cls === "ai") return "attested-ai";
    if (cls === "human") return "attested-human";
    if (declaredFlags[i]) return "declared";
    return "infer";
  };

  // Basis of every commit: attested (note) > declared (metadata) > inferred.
  let attestedAI = 0;
  let declaredCount = 0;
  let inferCandidates = 0;
  for (let i = 0; i < commits.length; i++) {
    const b = basisOf(i);
    // Line-level attestation (AI-Lines) weights a partially AI commit by its share.
    if (b === "attested-ai") attestedAI += attestedShare(attested.get(shas[i]));
    else if (b === "declared") declaredCount++;
    else if (b === "infer") inferCandidates++;
    // attested-human counts as human (in the remainder)
  }

  // Deep-scan the most recent commits in one bounded window — one API call each,
  // fewer without a token. Their diffs drive both the inferred sampling and the
  // per-directory breakdown.
  const deepMax = opts.token ? 40 : 12;
  const window = commits.slice(0, deepMax);
  const diffs = await mapLimit(window, 5, (c) => fetchCommitAddedLines(owner, repo, c.sha ?? "", headers));

  // per top-level directory line tallies, human vs AI
  const dirs = new Map<string, { human: number; ai: number }>();
  // `share` is the AI fraction of the commit's lines (0-1), so a partially
  // AI-assisted commit splits its lines instead of counting all-or-nothing.
  const bump = (dir: string, share: number, n: number) => {
    const cur = dirs.get(dir) ?? { human: 0, ai: 0 };
    cur.ai += n * share;
    cur.human += n * (1 - share);
    dirs.set(dir, cur);
  };

  let sampled = 0; // infer-candidate commits with substantive code
  let inferredInSample = 0;
  let totalLines = 0;

  for (let i = 0; i < window.length; i++) {
    const d = diffs[i];
    if (!d) continue; // fetch failed — skip
    const b = basisOf(i);
    let aiShare: number;
    if (b === "attested-ai") aiShare = attestedShare(attested.get(shas[i]));
    else if (b === "declared") aiShare = 1;
    else if (b === "attested-human") aiShare = 0;
    else {
      const { ai: isAI, ok } = classifyDiff(d);
      aiShare = 0;
      if (ok) {
        sampled++;
        if (isAI) inferredInSample++;
        aiShare = isAI ? 1 : 0;
      }
    }
    for (const [path, lns] of Object.entries(d)) {
      const n = lns.length;
      totalLines += n;
      bump(topDir(path), aiShare, n);
    }
  }

  const inferredRate = sampled > 0 ? inferredInSample / sampled : 0;
  const attestedFrac = attestedAI / total;
  const declaredFrac = declaredCount / total;
  const inferredFrac = inferredRate * (inferCandidates / total);
  const aiFrac = Math.min(1, attestedFrac + declaredFrac + inferredFrac);
  const humanFrac = 1 - aiFrac;

  // Top directories by line volume, as human/AI fractions (matches the CLI's
  // by_path schema so the ingest RPC stores them into repo_dirs).
  const byPath = [...dirs.entries()]
    .map(([path, v]) => ({ path, lines: v.human + v.ai, humanN: v.human, aiN: v.ai }))
    .filter((p) => p.lines > 0)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 12)
    .map((p) => ({
      path: p.path,
      human: p.humanN / p.lines,
      ai: p.aiN / p.lines,
      lines: p.lines,
      human_owned: false,
    }));

  // Risk over the deep-scan window: AI lines in critical paths without review
  // evidence, with the GitHub PR API consulted where it changes the answer.
  // Inference never labels a line here — only attested/declared commits count.
  const riskCommits: CloudRiskCommit[] = window.map((c, i) => {
    const b = basisOf(i);
    const note = attested.get(shas[i]);
    return {
      sha: c.sha ?? "",
      message: c.commit?.message ?? "",
      authorEmail: c.commit?.author?.email,
      committerEmail: c.commit?.committer?.email,
      added: diffs[i],
      aiHashes: b === "attested-ai" ? (note?.hashes ?? null) : null,
      wholeAI: b === "declared" || (b === "attested-ai" && !note?.hashes),
    };
  });
  const risk = await computeCloudRisk({ owner, repo, headers, commits: riskCommits });

  const report: GhReport = {
    schema: "grain/v0.1",
    repo: `${owner}/${repo}`,
    generated_at: new Date().toISOString(),
    range: { commits: commits.length },
    summary: {
      human: humanFrac,
      ai_assisted: aiFrac,
      unclassified: 0,
      lines: totalLines,
      ai_by_basis: { attested: attestedFrac, declared: declaredFrac, inferred: inferredFrac },
    },
    by_path: byPath,
    risk,
    attestations,
  };
  return {
    report,
    human: Math.round(humanFrac * 100),
    ai: Math.round(aiFrac * 100),
    commits: commits.length,
  };
}
