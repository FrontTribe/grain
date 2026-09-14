// Cloud-side risk analysis: AI-written lines that landed in critical paths
// without review evidence, over the commits a GitHub scan deep-scanned. Mirrors
// internal/risk in the engine, with one upgrade only the Cloud can make — review
// evidence comes from the GitHub PR API (an associated pull request, and whether
// someone other than the author approved it), not just from what git leaves.
import { createHash } from "crypto";

// Same built-in list as internal/risk.DefaultCritical.
export const DEFAULT_CRITICAL = [
  "auth", "authn", "authz", "login", "session", "token", "secret", "secrets",
  "crypto", "password", "payment", "payments", "billing", "checkout", "iam",
  "permission", "permissions", "migration", "migrations", "infra", "terraform",
  "k8s", "helm", "deploy", "workflows", "dockerfile",
];

// Identical to outcomes.LineHash in the engine: sha256 of the trimmed line,
// first 10 hex chars. Attestation notes carry these, so they must match exactly.
export function lineHash(line: string): string {
  return createHash("sha256").update(line.trim()).digest("hex").slice(0, 10);
}

export function substantive(line: string): boolean {
  return line.trim().length > 3;
}

// Parse the AI-Hashes line of a grain note into a set (null when absent).
export function parseAIHashes(note: string): Set<string> | null {
  for (const raw of note.split("\n")) {
    const idx = raw.indexOf(":");
    if (idx < 0) continue;
    if (raw.slice(0, idx).trim().toLowerCase() !== "ai-hashes") continue;
    const set = new Set<string>();
    for (const h of raw.slice(idx + 1).split(",")) {
      const t = h.trim();
      if (t) set.add(t);
    }
    return set.size ? set : null;
  }
  return null;
}

// Which pattern (if any) a path is critical under. Explicit patterns with a
// "/" or "*" match as prefixes ("src/auth/**"); bare fragments match a whole
// path segment or file stem, case-insensitively ("auth" hits src/auth/ and
// auth.go, not author.go). Same rules as the engine.
export function matchesCritical(path: string, patterns: string[]): string | null {
  const lower = path.toLowerCase();
  const segs = lower.split("/");
  for (const pat of patterns) {
    const p = pat.trim().toLowerCase();
    if (!p) continue;
    if (/[/*]/.test(p)) {
      const base = p.replace(/\/\*\*$/, "").replace(/\/\*$/, "").replace(/\/$/, "");
      if (base && (lower === base || lower.startsWith(base + "/"))) return pat;
      continue;
    }
    for (const seg of segs) {
      const dot = seg.lastIndexOf(".");
      const stem = dot > 0 ? seg.slice(0, dot) : seg;
      if (seg === p || stem === p) return pat;
    }
  }
  return null;
}

export type ReviewEvidence = "approved" | "pr" | "heuristic" | "none";

// What git itself leaves behind: a reviewer trailer, a squash "(#123)" or merge
// subject, or a committer other than the author (GitHub's merge button, a
// maintainer applying a patch).
export function heuristicReview(c: { message?: string; authorEmail?: string; committerEmail?: string }): boolean {
  const msg = c.message ?? "";
  if (/^\s*(reviewed-by|reviewed-on|approved-by):/im.test(msg)) return true;
  const subject = msg.split("\n")[0]?.trim() ?? "";
  if (/\(#\d+\)\s*$/.test(subject) || /^Merge (pull request|branch)\b/.test(subject)) return true;
  const a = (c.authorEmail ?? "").toLowerCase();
  const m = (c.committerEmail ?? "").toLowerCase();
  if (a && m && a !== m) return true;
  return false;
}

// Ask GitHub whether a commit belongs to a pull request and whether that PR
// carries an approval from someone other than its author. Best-effort.
export async function prEvidence(
  owner: string,
  repo: string,
  sha: string,
  headers: Record<string, string>,
): Promise<{ pr: number | null; approved: boolean }> {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  try {
    const res = await fetch(`${base}/commits/${encodeURIComponent(sha)}/pulls?per_page=5`, { headers, cache: "no-store" });
    if (!res.ok) return { pr: null, approved: false };
    const prs = (await res.json()) as { number?: number; user?: { login?: string } }[];
    if (!Array.isArray(prs) || prs.length === 0) return { pr: null, approved: false };
    const first = prs[0];
    const number = first.number ?? null;
    if (number == null) return { pr: null, approved: false };
    const rv = await fetch(`${base}/pulls/${number}/reviews?per_page=50`, { headers, cache: "no-store" });
    if (!rv.ok) return { pr: number, approved: false };
    const reviews = (await rv.json()) as { state?: string; user?: { login?: string } }[];
    const author = first.user?.login;
    const approved = Array.isArray(reviews) && reviews.some((r) => r.state === "APPROVED" && r.user?.login && r.user.login !== author);
    return { pr: number, approved };
  } catch {
    return { pr: null, approved: false };
  }
}

export type CloudRiskCommit = {
  sha: string;
  message: string;
  authorEmail?: string;
  committerEmail?: string;
  added: Record<string, string[]> | null; // per-file added lines
  aiHashes: Set<string> | null; // line-level attestation, when present
  wholeAI: boolean; // attested/declared as a whole
};

export type CloudRiskPath = { path: string; ai_lines: number; ai_unreviewed: number; commits: number };
export type CloudRiskHotspot = { sha: string; subject: string; path: string; ai_lines: number; evidence: ReviewEvidence };

export type CloudRisk = {
  ai_lines: number;
  ai_unreviewed: number;
  critical_ai_lines: number;
  critical_ai_unreviewed: number;
  approved_ai_lines: number; // critical AI lines whose PR carries an approval
  critical: CloudRiskPath[];
  top: CloudRiskHotspot[];
  patterns: string[];
  reviewed_commits: number;
  unreviewed_commits: number;
  commits: number; // the window examined
  source: "cloud";
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// Compute the risk block for a deep-scan window. PR lookups are made only for
// commits that actually put AI lines into a critical path and have no
// heuristic evidence — the only ones whose answer changes the headline.
export async function computeCloudRisk(opts: {
  owner: string;
  repo: string;
  headers: Record<string, string>;
  commits: CloudRiskCommit[];
  patterns?: string[];
}): Promise<{ risk: CloudRisk; evidence: Map<string, ReviewEvidence> }> {
  const patterns = opts.patterns?.length ? opts.patterns : DEFAULT_CRITICAL;
  const risk: CloudRisk = {
    ai_lines: 0, ai_unreviewed: 0, critical_ai_lines: 0, critical_ai_unreviewed: 0, approved_ai_lines: 0,
    critical: [], top: [], patterns, reviewed_commits: 0, unreviewed_commits: 0,
    commits: opts.commits.length, source: "cloud",
  };

  // Pass 1: attribute AI lines per file, per commit.
  type Attr = { c: CloudRiskCommit; total: number; critical: { path: string; pattern: string; n: number }[] };
  const attrs: Attr[] = [];
  for (const c of opts.commits) {
    if (!c.added || (!c.wholeAI && !c.aiHashes)) continue;
    let total = 0;
    const critical: Attr["critical"] = [];
    for (const [path, lines] of Object.entries(c.added)) {
      let n = 0;
      for (const l of lines) {
        if (!substantive(l)) continue;
        if (c.wholeAI || c.aiHashes?.has(lineHash(l))) n++;
      }
      if (n === 0) continue;
      total += n;
      const pattern = matchesCritical(path, patterns);
      if (pattern) critical.push({ path, pattern, n });
    }
    if (total > 0) attrs.push({ c, total, critical });
  }

  // Pass 2: review evidence. Heuristics are free; ask GitHub only where it matters.
  const evidence = new Map<string, ReviewEvidence>();
  const needPR: Attr[] = [];
  for (const a of attrs) {
    if (heuristicReview({ message: a.c.message, authorEmail: a.c.authorEmail, committerEmail: a.c.committerEmail })) {
      evidence.set(a.c.sha, "heuristic");
    } else if (a.critical.length > 0) {
      needPR.push(a);
    } else {
      evidence.set(a.c.sha, "none");
    }
  }
  const prResults = await mapLimit(needPR, 4, (a) => prEvidence(opts.owner, opts.repo, a.c.sha, opts.headers));
  needPR.forEach((a, i) => {
    const r = prResults[i];
    evidence.set(a.c.sha, r.approved ? "approved" : r.pr != null ? "pr" : "none");
  });

  // Pass 3: tally.
  const byPattern = new Map<string, CloudRiskPath>();
  const seen = new Set<string>();
  for (const a of attrs) {
    const ev = evidence.get(a.c.sha) ?? "none";
    const reviewed = ev !== "none";
    if (reviewed) risk.reviewed_commits++;
    else risk.unreviewed_commits++;
    risk.ai_lines += a.total;
    if (!reviewed) risk.ai_unreviewed += a.total;
    for (const { pattern, n } of a.critical) {
      risk.critical_ai_lines += n;
      if (ev === "approved") risk.approved_ai_lines += n;
      const ps = byPattern.get(pattern) ?? { path: pattern, ai_lines: 0, ai_unreviewed: 0, commits: 0 };
      ps.ai_lines += n;
      const key = pattern + "\0" + a.c.sha;
      if (!seen.has(key)) {
        seen.add(key);
        ps.commits++;
      }
      if (!reviewed) {
        risk.critical_ai_unreviewed += n;
        ps.ai_unreviewed += n;
        risk.top.push({ sha: a.c.sha, subject: (a.c.message.split("\n")[0] ?? "").trim(), path: pattern, ai_lines: n, evidence: ev });
      }
      byPattern.set(pattern, ps);
    }
  }
  risk.critical = [...byPattern.values()].sort((x, y) => y.ai_unreviewed - x.ai_unreviewed || y.ai_lines - x.ai_lines);
  risk.top.sort((x, y) => y.ai_lines - x.ai_lines);
  risk.top = risk.top.slice(0, 10);
  // The evidence map is returned so the security pass can reuse it.
  return { risk, evidence };
}
