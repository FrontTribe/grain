// TypeScript port of the Go inferred content classifier (internal/features +
// internal/classify), kept faithful so the Cloud GitHub scan produces the same
// inferred AI-likelihood the CLI does. Lexical only (regex/token scans), every
// feature normalized to [0,1] where higher = more AI-like, confidence capped.

// ---- feature set (mirrors internal/features, SetID "f1") ----

export const FEATURE_SET_ID = "f1";

export const FEATURE_KEYS = [
  "comment_density",
  "docstring_completeness",
  "naming_descriptiveness",
  "naming_consistency",
  "func_length_uniformity",
  "line_length_regularity",
  "blank_line_regularity",
  "boilerplate_ratio",
  "error_handling_density",
  "todo_absence",
] as const;

// A feature vector in FEATURE_KEYS order.
export type Features = number[];

type LangSpec = {
  lineComment: string[];
  funcRe: RegExp | null;
  errRe: RegExp | null;
  pyDoc: boolean;
};

const identRe = /[A-Za-z_][A-Za-z0-9_]*/g;
const todoRe = /\b(todo|fixme|hack|xxx)\b/i;

const SPECS: Record<string, LangSpec> = {
  go: {
    lineComment: ["//"],
    funcRe: /^\s*func\b/,
    errRe: /if\s+err\s*!=\s*nil|errors\.|fmt\.Errorf|panic\(/,
    pyDoc: false,
  },
  js: {
    lineComment: ["//"],
    funcRe: /\bfunction\b|=>|^\s*(async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/,
    errRe: /\b(try|catch|throw|finally)\b/,
    pyDoc: false,
  },
  python: {
    lineComment: ["#"],
    funcRe: /^\s*(async\s+)?def\b/,
    errRe: /\b(try|except|raise|finally)\b/,
    pyDoc: true,
  },
  generic: {
    lineComment: ["//", "#"],
    funcRe: null,
    errRe: /\b(try|catch|except|throw|raise)\b/,
    pyDoc: false,
  },
};

function detectLang(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
  if (ext === ".go") return "go";
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) return "js";
  if ([".py", ".pyi"].includes(ext)) return "python";
  return "generic";
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function isComment(trimmed: string, prefixes: string[]): boolean {
  if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;
  return prefixes.some((p) => trimmed.startsWith(p));
}

function hasInternalUpper(id: string): boolean {
  for (let i = 1; i < id.length; i++) {
    const c = id[i];
    if (c >= "A" && c <= "Z") return true;
  }
  return false;
}

// 1 - coefficient of variation (population std), clamped. Uniform values → ~1.
function regularity(xs: number[]): number {
  if (xs.length < 2) return 0.5;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0.5;
  let v = 0;
  for (const x of xs) v += (x - mean) * (x - mean);
  const cv = Math.sqrt(v / xs.length) / mean;
  return clamp01(1 - cv);
}

function codeRunLengths(added: string[]): number[] {
  const runs: number[] = [];
  let cur = 0;
  for (const raw of added) {
    if (raw.trim() === "") {
      if (cur > 0) {
        runs.push(cur);
        cur = 0;
      }
      continue;
    }
    cur++;
  }
  if (cur > 0) runs.push(cur);
  return runs;
}

function duplicateRatio(code: string[]): number {
  const seen = new Map<string, number>();
  let substantive = 0;
  for (const l of code) {
    const t = l.trim();
    if (t.length <= 3) continue;
    substantive++;
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  if (substantive === 0) return 0;
  let dupes = 0;
  for (const n of seen.values()) if (n > 1) dupes += n - 1;
  return clamp01(dupes / substantive);
}

function funcStats(added: string[], spec: LangSpec): [number, number] {
  const starts: number[] = [];
  for (let i = 0; i < added.length; i++) {
    if (spec.funcRe!.test(added[i])) starts.push(i);
  }
  if (starts.length === 0) return [-1, -1];

  let documented = 0;
  for (const s of starts) {
    if (spec.pyDoc) {
      if (s + 1 < added.length) {
        const n = added[s + 1].trim();
        if (n.startsWith('"""') || n.startsWith("'''")) documented++;
      }
    } else if (s - 1 >= 0 && isComment(added[s - 1].trim(), spec.lineComment)) {
      documented++;
    }
  }
  const docFrac = documented / starts.length;

  let uniform = -1;
  if (starts.length >= 2) {
    const lengths: number[] = [];
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1] : added.length;
      lengths.push(end - starts[i]);
    }
    uniform = regularity(lengths);
  }
  return [uniform, docFrac];
}

/** Compute the feature vector for one file's added lines (without leading '+'). */
export function extract(path: string, added: string[]): Features {
  const spec = SPECS[detectLang(path)];

  const code: string[] = [];
  const comments: string[] = [];
  for (const raw of added) {
    const t = raw.trim();
    if (t === "") continue;
    if (isComment(t, spec.lineComment)) comments.push(t);
    else code.push(raw);
  }
  const nCode = code.length;

  // neutral defaults for signals that need structure to be meaningful
  const f: Record<string, number> = {
    comment_density: 0,
    docstring_completeness: 0.5,
    naming_descriptiveness: 0,
    naming_consistency: 0.5,
    func_length_uniformity: 0.5,
    line_length_regularity: 0.5,
    blank_line_regularity: 0.5,
    boilerplate_ratio: 0,
    error_handling_density: 0,
    todo_absence: 1.0,
  };
  if (nCode === 0) return FEATURE_KEYS.map((k) => f[k]);

  f.comment_density = clamp01(comments.length / (nCode + comments.length) / 0.35);

  if (spec.errRe) {
    let errLines = 0;
    for (const l of code) if (spec.errRe.test(l)) errLines++;
    f.error_handling_density = clamp01((errLines / nCode) * 5);
  }

  for (const l of [...code, ...comments]) {
    if (todoRe.test(l)) {
      f.todo_absence = 0;
      break;
    }
  }

  const idents: string[] = [];
  for (const l of code) idents.push(...(l.match(identRe) ?? []));
  if (idents.length > 0) {
    let total = 0;
    let snake = 0;
    let camel = 0;
    for (const id of idents) {
      total += id.length;
      if (id.includes("_") && id.toLowerCase() === id) snake++;
      else if (hasInternalUpper(id)) camel++;
    }
    const avgLen = total / idents.length;
    f.naming_descriptiveness = clamp01((avgLen - 3) / 12);
    if (snake + camel > 0) f.naming_consistency = Math.max(snake, camel) / (snake + camel);
  }

  const lens = code.map((l) => l.replace(/[ \t]+$/, "").length);
  f.line_length_regularity = regularity(lens);

  const runs = codeRunLengths(added);
  if (runs.length >= 2) f.blank_line_regularity = regularity(runs);

  f.boilerplate_ratio = duplicateRatio(code);

  if (spec.funcRe) {
    const [uniform, docFrac] = funcStats(added, spec);
    if (uniform >= 0) f.func_length_uniformity = uniform;
    if (docFrac >= 0) f.docstring_completeness = docFrac;
  }

  return FEATURE_KEYS.map((k) => f[k]);
}

/** Line-weighted mean feature vector across a commit's added lines by file. */
export function aggregate(added: Record<string, string[]>): { features: Features; ok: boolean } {
  const agg = new Array(FEATURE_KEYS.length).fill(0);
  let wsum = 0;
  for (const [path, lns] of Object.entries(added)) {
    const fv = extract(path, lns);
    const w = lns.length;
    for (let j = 0; j < agg.length; j++) agg[j] += fv[j] * w;
    wsum += w;
  }
  if (wsum === 0) return { features: agg, ok: false };
  for (let j = 0; j < agg.length; j++) agg[j] /= wsum;
  return { features: agg, ok: true };
}

// ---- classifier (mirrors internal/classify, model "w2-content") ----

export const CONFIDENCE_CAP = 0.7;
export const MODEL_ID = "w2-content";
export const WEIGHTS_ID = `${MODEL_ID}/${FEATURE_SET_ID}`;

// order matches FEATURE_KEYS
const WEIGHTS = [1.2, 1.6, 1.2, 0.6, 0.5, 0.5, 0.4, 1.0, 1.2, 1.4];
const BIAS = 0;
const CAL_A = 1;
const CAL_B = 0;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export type ScoreResult = { aiLikelihood: number; confidence: number };

/** Classify a feature vector into a calibrated AI-likelihood + capped confidence. */
export function score(features: Features): ScoreResult {
  let z = BIAS;
  for (let i = 0; i < FEATURE_KEYS.length; i++) {
    const w = i < WEIGHTS.length ? WEIGHTS[i] : 0;
    z += w * ((features[i] ?? 0) - 0.5);
  }
  const p = sigmoid(CAL_A * z + CAL_B);
  const confidence = Math.min(CONFIDENCE_CAP, 0.4 + 0.3 * Math.abs(2 * p - 1));
  return { aiLikelihood: p, confidence };
}

/** Classify a commit's added-lines-by-file. ok=false when there's no substance. */
export function classifyDiff(added: Record<string, string[]>): { ai: boolean; result: ScoreResult; ok: boolean } {
  const { features, ok } = aggregate(added);
  if (!ok) return { ai: false, result: { aiLikelihood: 0, confidence: 0 }, ok: false };
  const result = score(features);
  return { ai: result.aiLikelihood > 0.5, result, ok: true };
}
