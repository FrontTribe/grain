# Content classifier v1 — implementation plan

**Goal.** Replace Grain's weak inferred heuristic (`inferFeatures`: a diff-size
logistic) with a **content-based** classifier that reads the actual added code,
extracts interpretable lexical/structural features, and outputs a *calibrated*
AI-likelihood — still capped at the inferred ceiling (**0.70**) and validated
against the repo's **declared** commits as ground truth.

## Design constraints (why v1 looks the way it does)

- **stdlib-only Go.** Grain ships with no `go.sum`, no dependencies. v1 must keep
  that. → v1 is a **pure feature-based classifier** (interpretable features +
  logistic scorer). No ML runtime.
- **Perplexity is v2.** A local code-model perplexity signal is strong but needs a
  runtime (llama.cpp/ONNX) → an optional `grain-ml` sidecar, out of scope here.
- **Local-first.** Runs entirely on-box; emits only scores + feature attributions.
- **Explainable & capped.** Basis stays `"inferred"`, confidence ≤ 0.70, and every
  score can show its top contributing features (`grain explain`).

## Architecture

```
internal/features   ← NEW: extract features from a commit's added lines (per language)
internal/classify   ← NEW: logistic model + calibration; features → AI-likelihood
internal/score      ← MODIFIED: Classify() uses content classifier for the inferred path
cmd/grain (eval)    ← NEW: `grain eval` — measure/calibrate against declared commits
```

Data flow (no declared signal present):
`commit diff → features.Extract() → classify.Score() → cap(0.70) → bucket()`

Declared signals still win: if `signal.Set.DeclaredAI`, we never fall to the
classifier (Tier 2 > Tier 3, unchanged).

## Features (v1 set — lexical, no full AST yet)

Computed from the commit's **added** lines only, language-detected by extension.
Start with **Go, JS/TS, Python** (cover the classifier interface for others as
"generic"). Each feature is cheap (regex/token scan), interpretable, and language-
parameterized:

| Feature | Signal intuition (AI tends to…) |
|---|---|
| comment_density | over-comment / add explanatory comments |
| docstring_completeness | put a docstring/JSDoc on every new function |
| naming_descriptiveness | use long, "complete" identifier names |
| naming_consistency | never mix snake/camel within a hunk |
| func_length_uniformity | produce similarly-sized functions (low variance) |
| line_length_regularity | consistent line lengths |
| blank_line_regularity | uniform spacing between blocks |
| boilerplate_ratio | reproduce near-duplicate / canonical blocks |
| error_handling_density | exhaustive, textbook error handling |
| todo_absence | omit TODO/FIXME/hacks a human leaves |

Each returns a normalized `[0,1]`. The set is versioned (bumps `WeightsID`).

## Scorer (`internal/classify`)

- **Model:** logistic regression over the feature vector →
  `p_ai = sigmoid(Σ wᵢ·fᵢ + b)`. Small, transparent, no dependency.
- **Weights:** ship sane hand-set defaults (`w1`), refined by the eval harness on
  real data. Weights + feature-set id are pinned for reproducibility.
- **Calibration:** Platt scaling (a,b) so `p_ai` is a *calibrated probability*, not
  a raw score. Per-repo calibration optional (uses declared history).
- **Output:** `{ ai_likelihood, confidence, contributions[] }`. Confidence is a
  function of feature agreement, **hard-capped at 0.70**.

## `grain eval` — the ground-truth harness (also seeds the self-improving loop)

```
grain eval [-C dir] [--fit] [--report json|text]
```
- Labels the repo's history from **declared** signals: `Co-Authored-By: <agent>` →
  AI; human-only / no signal → human. (Held-out; declared commits are the test set.)
- Runs `features.Extract` + `classify.Score` on each, computes **AUC, precision,
  recall, F1, and ECE (calibration error)** vs the current burst-heuristic baseline.
- `--fit` refits logistic weights + Platt params locally and writes a per-repo
  `weights` block (opt-in). Prints a **calibration report** — the artifact that
  powers "measured, honest confidence".

## Integration into `score.Classify`

- New config gate: `.grain.toml [detection] content_classifier = true`.
- When enabled and no declared AI signal: run the classifier instead of the v0
  burst heuristic (or blend: `max`/weighted). Keep `Basis = "inferred"`, cap 0.70.
- Bump `report.WeightsID` (`w1` → `w2-content`) so `grain.json` stays reproducible.
- `grain explain <sha>` prints the top feature contributions (the "why").

## Milestones

| M | Deliverable | Done when |
|---|---|---|
| M1 | `internal/features` + tests | features extract for Go/JS/TS/Py, deterministic |
| M2 | `internal/classify` logistic + calibration + defaults | scores a feature vector, capped |
| M3 | `grain eval` harness | reports AUC/PR/ECE vs baseline on a repo's declared set |
| M4 | wire into `score.Classify` behind flag; bump WeightsID; `grain explain` | end-to-end, reproducible |
| M5 | validate on grain itself + 3–5 OSS repos; tune default weights | AUC beats baseline; report published |

## Success metrics

- **AUC** on the held-out declared set **> baseline** (current heuristic) by a
  meaningful margin (target ≥ +0.15 AUC).
- **Calibration (ECE)** low — when we say 0.6, it's ~60% AI in reality.
- **No confidence > 0.70** ever emitted on the inferred path.
- Every classification is **explainable** (top-3 features shown).

## Risks & mitigations

- **False positives** (careful humans / human-edited AI): keep 0.70 cap, report
  intervals, lean on human-owned-path policy rather than blanket verdicts.
- **Language coverage**: ship 3 langs + a generic fallback; expand by demand.
- **Feature gaming**: features are a floor, not proof; Tier 1 capture is the
  long-term answer.
- **Small declared sets** (repos with few AI commits): fall back to shipped default
  weights; skip per-repo `--fit` under a min-sample threshold.

## Out of scope for v1 (tracked in ROADMAP)

Perplexity / local code model (v2 sidecar), editor telemetry (Tier 1), per-author
stylometry, IDE plugin.
