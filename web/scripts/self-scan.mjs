// Regenerates src/lib/self-scan.ts from the repository's own grain.json, so
// the landing page always quotes real numbers. Run from web/ after `grain scan`
// at the repo root:  node scripts/self-scan.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(readFileSync(resolve(here, "../../grain.json"), "utf8"));
const cls = (c) => (c.class === "ai_authored" || c.class === "ai_assisted" ? "a" : c.class === "human_authored" ? "h" : "u");
const commits = [...j.commits].reverse().map((c) => ({ c: cls(c), w: c.lines }));
const pct = (x) => Math.round(x * 100);

const summary = {
  generated: j.generated_at.slice(0, 10),
  commits: j.commits.length,
  human: pct(j.summary.human),
  ai: pct(j.summary.ai_assisted),
  attested: pct(j.summary.ai_by_basis.attested),
  declared: pct(j.summary.ai_by_basis.declared),
  inferred: pct(j.summary.ai_by_basis.inferred),
  risk: {
    lines: j.risk.critical_ai_lines,
    unreviewed: j.risk.critical_ai_unreviewed,
    paths: j.risk.critical.map((p) => ({ path: p.path, lines: p.ai_lines })),
    hotspots: j.risk.top.slice(0, 3).map((h) => ({ sha: h.sha.slice(0, 7), subject: h.subject, path: h.path, lines: h.ai_lines })),
  },
  outcomes: {
    ai_lines: j.outcomes.strict.ai_lines,
    ai_reworked: j.outcomes.strict.ai_reworked,
    ai_in_fix: j.outcomes.strict.ai_reworked_in_fix,
    ai_median: j.outcomes.strict.ai_median_commits_to_rework,
    human_lines: j.outcomes.strict.human_lines,
    human_reworked: j.outcomes.strict.human_reworked,
    human_in_fix: j.outcomes.strict.human_reworked_in_fix,
    human_median: j.outcomes.strict.human_median_commits_to_rework,
  },
  by_path: j.by_path.slice(0, 6).map((p) => ({ path: p.path, ai: pct(p.ai), lines: p.lines })),
};

const out = `// Real numbers from grain scanning its own repository (FrontTribe/grain),
// generated ${summary.generated} from grain.json. Regenerate with:
//   grain scan && node scripts/self-scan.mjs
export const SELF_SCAN = ${JSON.stringify(summary, null, 2)} as const;

// One entry per commit, oldest first: authorship class and lines changed.
export const SELF_COMMITS: { c: "h" | "a" | "u"; w: number }[] = ${JSON.stringify(commits)};
`;
writeFileSync(resolve(here, "../src/lib/self-scan.ts"), out);
console.log(`self-scan.ts: ${summary.commits} commits, ${summary.ai}% AI, ${summary.risk.unreviewed} critical unreviewed`);
