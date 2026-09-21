// Cloud-side dependency analysis: which dependencies the scanned commits
// added, attributed like the risk pass (AI-written or not, review evidence or
// not), and checked against the public registries: does the package exist,
// and how old is it. Agents hallucinate names; attackers register them
// (slopsquatting). Mirrors internal/deps; only package names leave the server.
import { lineHash, substantive, type CloudRiskCommit, type ReviewEvidence } from "@/lib/risk";
import { triageDeps, suspicious, type DepTriage } from "@/lib/triage";

export type Ecosystem = "npm" | "go" | "pypi" | "cargo" | "rubygems";

export type CloudDep = {
  name: string;
  ecosystem: Ecosystem;
  manifest: string;
  sha: string;
  subject: string;
  ai: boolean;
  reviewed: boolean;
  checked: boolean;
  exists: boolean;
  age_days: number; // -1 when unknown
  url: string;
  triage?: DepTriage; // Cloud name triage (TypeSafe Jev), when enabled
};

export type CloudDeps = {
  total: number;
  ai: number;
  ai_unreviewed: number;
  checked: boolean;
  missing: number;
  young: number;
  suspicious: number; // names that look typosquatted or invented (triage)
  deps: CloudDep[];
  commits: number;
  source: "cloud";
};

export const YOUNG_DAYS = 30;
const MAX_DEPS = 60;

const manifestRe = /(^|\/)(package\.json|go\.mod|requirements[\w.-]*\.txt|pyproject\.toml|Cargo\.toml|Gemfile)$/i;
export function isManifest(path: string): boolean {
  return manifestRe.test(path);
}

const npmLine = /^\s*"(@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)?)"\s*:\s*"([^"]*)"\s*,?\s*$/;
const npmRange = /^(\^|~|>=?|<=?|=|\*$|latest$|next$|\d|workspace:|npm:|file:|link:|git\+|github:|https?:\/\/)/;
const npmNotDep = new Set(["name", "version", "description", "main", "module", "types", "typings", "license", "author", "homepage", "type", "packageManager", "node", "npm", "yarn", "pnpm", "bun", "engine-strict", "browser", "exports", "files", "url", "bugs", "funding", "repository", "keywords", "private", "sideEffects", "publishConfig", "bin", "directories", "os", "cpu", "email", "scripts"]);
const goLine = /^\s*([a-z0-9][a-z0-9.-]*\.[a-z]{2,}\/[\w./~-]+)\s+v\d[\w.+-]*\s*$/;
const pyReqRe = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<|===|;|$)/;
const pyArrRe = /^\s*"([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*[^"]*",?\s*$/;
const poetryRe = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*=\s*("[^"]*"|\{)/;
const cargoRe = /^\s*([A-Za-z0-9][A-Za-z0-9_-]*)\s*=\s*("[^"]*"|\{)/;
const cargoNot = new Set(["name", "version", "edition", "authors", "description", "license", "repository", "readme", "keywords", "categories", "build", "rust-version", "default-run", "publish", "homepage", "documentation", "exclude", "include", "workspace", "resolver", "members", "path", "features", "default", "opt-level", "lto", "codegen-units", "panic"]);
const gemRe = /^\s*gem\s+['"]([^'"]+)['"]/;
const pyNot = new Set(["python", "pip", "setuptools", "wheel", "name", "version", "description", "readme", "license", "authors", "maintainers", "requires-python", "dependencies", "keywords", "classifiers", "urls", "homepage", "repository", "documentation", "packages", "include", "exclude"]);

// The dependency an added manifest line introduces, if any.
export function parseDep(path: string, line: string): { name: string; ecosystem: Ecosystem } | null {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const t = line.trim();
  if (!t || t.startsWith("#") || t.startsWith("//")) return null;
  if (base === "package.json") {
    const m = npmLine.exec(line);
    if (!m || npmNotDep.has(m[1]) || !npmRange.test(m[2])) return null;
    return { name: m[1], ecosystem: "npm" };
  }
  if (base === "go.mod") {
    if (line.includes("// indirect")) return null;
    const m = goLine.exec(line);
    return m ? { name: m[1], ecosystem: "go" } : null;
  }
  if (base.startsWith("requirements") && base.endsWith(".txt")) {
    if (t.startsWith("-") || t.includes("://")) return null;
    const m = pyReqRe.exec(t);
    if (!m || pyNot.has(m[1].toLowerCase())) return null;
    return { name: m[1].toLowerCase(), ecosystem: "pypi" };
  }
  if (base === "pyproject.toml") {
    const a = pyArrRe.exec(line);
    if (a && !pyNot.has(a[1].toLowerCase())) return { name: a[1].toLowerCase(), ecosystem: "pypi" };
    const p = poetryRe.exec(line);
    if (p && !pyNot.has(p[1].toLowerCase()) && !p[1].includes(".")) return { name: p[1].toLowerCase(), ecosystem: "pypi" };
    return null;
  }
  if (base === "cargo.toml") {
    const m = cargoRe.exec(line);
    if (!m || cargoNot.has(m[1])) return null;
    return { name: m[1], ecosystem: "cargo" };
  }
  if (base === "gemfile") {
    const m = gemRe.exec(line);
    return m ? { name: m[1], ecosystem: "rubygems" } : null;
  }
  return null;
}

export function registryUrl(eco: Ecosystem, name: string): string {
  switch (eco) {
    case "npm": return `https://www.npmjs.com/package/${name}`;
    case "pypi": return `https://pypi.org/project/${name}/`;
    case "go": return `https://pkg.go.dev/${name}`;
    case "cargo": return `https://crates.io/crates/${name}`;
    case "rubygems": return `https://rubygems.org/gems/${name}`;
  }
}

const ageDays = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : -1;
};

const escapeGoModule = (m: string) => m.replace(/[A-Z]/g, (c) => "!" + c.toLowerCase());

// Ask a registry whether a package exists and when it was created. Returns
// null when the registry couldn't be reached or answered unexpectedly.
export async function lookup(eco: Ecosystem, name: string): Promise<{ exists: boolean; age_days: number } | null> {
  const headers = { "User-Agent": "grain (https://github.com/FrontTribe/grain)", Accept: "application/json" };
  const get = async (url: string): Promise<{ status: number; body: unknown }> => {
    try {
      const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(6000) });
      let body: unknown = null;
      try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null };
    }
  };
  type Obj = Record<string, unknown>;
  switch (eco) {
    case "npm": {
      const r = await get(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
      if (r.status === 404) return { exists: false, age_days: -1 };
      if (r.status !== 200) return null;
      const created = ((r.body as Obj)?.time as Obj | undefined)?.created;
      return { exists: true, age_days: typeof created === "string" ? ageDays(created) : -1 };
    }
    case "pypi": {
      const r = await get(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
      if (r.status === 404) return { exists: false, age_days: -1 };
      if (r.status !== 200) return null;
      let earliest = -1;
      const releases = (r.body as Obj)?.releases as Record<string, Obj[]> | undefined;
      for (const files of Object.values(releases ?? {})) {
        for (const f of files ?? []) {
          const up = f?.upload_time_iso_8601;
          if (typeof up === "string") earliest = Math.max(earliest, ageDays(up));
        }
      }
      return { exists: true, age_days: earliest };
    }
    case "go": {
      const r = await get(`https://proxy.golang.org/${escapeGoModule(name)}/@latest`);
      if (r.status === 404 || r.status === 410) return { exists: false, age_days: -1 };
      if (r.status !== 200) return null;
      return { exists: true, age_days: -1 };
    }
    case "cargo": {
      const r = await get(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
      if (r.status === 404) return { exists: false, age_days: -1 };
      if (r.status !== 200) return null;
      const created = ((r.body as Obj)?.crate as Obj | undefined)?.created_at;
      return { exists: true, age_days: typeof created === "string" ? ageDays(created) : -1 };
    }
    case "rubygems": {
      const r = await get(`https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`);
      if (r.status === 404) return { exists: false, age_days: -1 };
      if (r.status !== 200) return null;
      const created = (r.body as Obj)?.created_at;
      return { exists: true, age_days: typeof created === "string" ? ageDays(created) : -1 };
    }
  }
}

function rank(d: CloudDep): number {
  return (suspicious(d.triage, d) ? 32 : 0) + (d.checked && !d.exists ? 16 : 0) + (d.checked && d.exists && d.age_days >= 0 && d.age_days < YOUNG_DAYS ? 8 : 0) + (d.ai ? 4 : 0) + (d.reviewed ? 0 : 2);
}

// Commits arrive newest first; walk them oldest first so a dependency is
// attributed to the commit that introduced it.
export async function computeCloudDeps(opts: { commits: CloudRiskCommit[]; evidence: Map<string, ReviewEvidence>; checkRegistry?: boolean }): Promise<CloudDeps> {
  const check = opts.checkRegistry ?? true;
  const seen = new Set<string>();
  const deps: CloudDep[] = [];
  for (let i = opts.commits.length - 1; i >= 0; i--) {
    const c = opts.commits[i];
    if (!c.added) continue;
    const reviewed = (opts.evidence.get(c.sha) ?? "none") !== "none";
    for (const [path, lines] of Object.entries(c.added)) {
      if (!isManifest(path)) continue;
      for (const l of lines) {
        const d = parseDep(path, l);
        if (!d) continue;
        const key = `${d.ecosystem}/${d.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ai = c.wholeAI || (!!c.aiHashes && substantive(l) && c.aiHashes.has(lineHash(l)));
        deps.push({ name: d.name, ecosystem: d.ecosystem, manifest: path, sha: c.sha, subject: (c.message.split("\n")[0] ?? "").trim(), ai, reviewed, checked: false, exists: false, age_days: -1, url: registryUrl(d.ecosystem, d.name) });
      }
    }
  }
  if (check) {
    await Promise.all(deps.map(async (d) => {
      const r = await lookup(d.ecosystem, d.name);
      if (r) { d.checked = true; d.exists = r.exists; d.age_days = r.age_days; }
    }));
  }
  // Name triage after the registry answer, so the model sees it too.
  const triage = await triageDeps(deps);
  for (const d of deps) {
    const t = triage.get(`${d.ecosystem}/${d.name}`);
    if (t) d.triage = t;
  }
  const out: CloudDeps = { total: deps.length, ai: 0, ai_unreviewed: 0, checked: check, missing: 0, young: 0, suspicious: 0, deps: [], commits: opts.commits.length, source: "cloud" };
  for (const d of deps) {
    if (d.ai) { out.ai++; if (!d.reviewed) out.ai_unreviewed++; }
    if (d.checked && !d.exists) out.missing++;
    if (d.checked && d.exists && d.age_days >= 0 && d.age_days < YOUNG_DAYS) out.young++;
    if (suspicious(d.triage, d)) out.suspicious++;
  }
  out.deps = deps.sort((a, b) => rank(b) - rank(a)).slice(0, MAX_DEPS);
  return out;
}
