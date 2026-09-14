// Cloud-side security analysis: the same conservative danger patterns as
// internal/security (one JSON, copied verbatim; a Go test keeps the copies
// identical), joined with the provenance and review evidence the Cloud risk
// pass already computed. Not a vulnerability scanner: the provenance layer
// pointing at the lines worth a second look. Signals, not verdicts.
import specs from "@/lib/security-patterns.json";
import { lineHash, substantive, matchesCritical, DEFAULT_CRITICAL, type CloudRiskCommit, type ReviewEvidence } from "@/lib/risk";

type Spec = {
  id: string;
  title: string;
  severity: "high" | "medium";
  re: string;
  flags?: string;
  unless?: string;
  paths?: string;
  redact?: boolean;
  once?: boolean;
  note: string;
};

export type Pattern = Spec & { rx: RegExp; unlessRx: RegExp | null; pathsRx: RegExp | null };

let compiled: Pattern[] | null = null;
export function patterns(): Pattern[] {
  if (!compiled) {
    compiled = (specs as Spec[]).map((s) => ({
      ...s,
      rx: new RegExp(s.re, s.flags ?? ""),
      unlessRx: s.unless ? new RegExp(s.unless, "i") : null,
      pathsRx: s.paths ? new RegExp(s.paths, "i") : null,
    }));
  }
  return compiled;
}

const commentLine = /^\s*(\/\/|#|\*|\/\*|--|<!--)/;
const defineLine = /regexp\.MustCompile\(|new RegExp\(|re\.compile\(|"re":\s*"/;
const testPath = /(^|\/)(test|tests|__tests__|spec|specs|fixtures?|testdata|mocks?|examples?)(\/|$)|_test\.go$|\.(test|spec)\.[jt]sx?$|\.snap$|\.(md|mdx|markdown|rst|txt|adoc)$/i;

export function skipPath(path: string): boolean {
  return testPath.test(path);
}

// The patterns a single added line trips, for a file at path.
export function check(path: string, line: string): Pattern[] {
  if (skipPath(path) || commentLine.test(line) || defineLine.test(line)) return [];
  const hits: Pattern[] = [];
  for (const p of patterns()) {
    if (p.pathsRx && !p.pathsRx.test(path)) continue;
    if (!p.rx.test(line)) continue;
    if (p.unlessRx && p.unlessRx.test(line)) continue;
    hits.push(p);
  }
  return hits;
}

export function excerpt(p: Pattern, line: string): string {
  let s = line.trim();
  if (p.redact) s = s.replace(new RegExp(p.re, (p.flags ?? "") + "g"), (m) => (m.length <= 8 ? "…" : m.slice(0, 6) + "…"));
  if (s.length > 120) s = s.slice(0, 117) + "…";
  return s;
}

export type SecurityFinding = {
  pattern: string;
  title: string;
  severity: "high" | "medium";
  path: string;
  sha: string;
  subject: string;
  excerpt: string;
  ai: boolean;
  reviewed: boolean;
  critical: string;
  note: string;
  evidence?: ReviewEvidence;
};

export type CloudSecurity = {
  total: number;
  ai: number;
  ai_unreviewed: number;
  ai_critical_unreviewed: number;
  human: number;
  by_pattern: { id: string; title: string; severity: string; ai: number; human: number }[];
  findings: SecurityFinding[];
  commits: number;
  source: "cloud";
};

const MAX_FINDINGS = 50;

function rank(f: SecurityFinding): number {
  return (f.ai ? 8 : 0) + (f.reviewed ? 0 : 4) + (f.critical ? 2 : 0) + (f.severity === "high" ? 1 : 0);
}

// Same inputs as the risk pass, plus the review evidence it resolved per SHA
// (so the PR-API answer is reused, not fetched twice).
export function computeCloudSecurity(opts: {
  commits: CloudRiskCommit[];
  evidence: Map<string, ReviewEvidence>;
  patterns?: string[];
}): CloudSecurity {
  const crit = opts.patterns?.length ? opts.patterns : DEFAULT_CRITICAL;
  const out: CloudSecurity = { total: 0, ai: 0, ai_unreviewed: 0, ai_critical_unreviewed: 0, human: 0, by_pattern: [], findings: [], commits: opts.commits.length, source: "cloud" };
  const byPat = new Map<string, CloudSecurity["by_pattern"][number]>();
  const all: SecurityFinding[] = [];

  for (const c of opts.commits) {
    if (!c.added) continue;
    const ev = opts.evidence.get(c.sha) ?? "none";
    const reviewed = ev !== "none";
    for (const [path, lines] of Object.entries(c.added)) {
      if (skipPath(path)) continue;
      const critical = matchesCritical(path, crit) ?? "";
      const seenOnce = new Set<string>();
      for (const l of lines) {
        for (const p of check(path, l)) {
          if (p.once) {
            if (seenOnce.has(p.id)) continue;
            seenOnce.add(p.id);
          }
          const ai = c.wholeAI || (!!c.aiHashes && substantive(l) && c.aiHashes.has(lineHash(l)));
          const f: SecurityFinding = {
            pattern: p.id, title: p.title, severity: p.severity, note: p.note,
            path, sha: c.sha, subject: (c.message.split("\n")[0] ?? "").trim(),
            excerpt: p.once ? "" : excerpt(p, l), ai, reviewed, critical, evidence: ev,
          };
          all.push(f);
          out.total++;
          const pc = byPat.get(p.id) ?? { id: p.id, title: p.title, severity: p.severity, ai: 0, human: 0 };
          if (ai) {
            out.ai++;
            pc.ai++;
            if (!reviewed) {
              out.ai_unreviewed++;
              if (critical) out.ai_critical_unreviewed++;
            }
          } else {
            out.human++;
            pc.human++;
          }
          byPat.set(p.id, pc);
        }
      }
    }
  }
  out.by_pattern = [...byPat.values()].sort((a, b) => b.ai - a.ai || a.id.localeCompare(b.id));
  all.sort((a, b) => rank(b) - rank(a));
  out.findings = all.slice(0, MAX_FINDINGS);
  return out;
}
