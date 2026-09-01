# Grain detection roadmap

How Grain decides whether code is human- or AI-authored — and where we take it.
Principle throughout: **Signals, not verdicts.** We separate what we *know* from
what we *guess*, cap the guesses, and publish measured accuracy instead of a
confident single number.

## The three tiers (prefer top-down)

Detection is not one technique. Three strategies trade off accuracy vs adoption
cost vs gaming-resistance. The engine layers all three and always prefers the
higher tier when present.

### Tier 1 — ATTESTED (capture at the source · near-truth)
Don't detect — *record* provenance as code is written.
- **Editor / agent telemetry**: Copilot / Cursor / Codex / Windsurf / JetBrains AI
  "accepted suggestion" events with line ranges → ground-truth, line-level.
- **IDE plugin**: typed-vs-pasted-vs-autocompleted per span, stored as metadata
  before commit.
- **Provenance standard**: agents write provenance (Claude already writes
  `Co-Authored-By`); Grain becomes the *reader of truth*, not a guesser.
- Confidence: ~0.98. The long-term moat.

### Tier 2 — DECLARED (trailers · high confidence when present) — *shipped*
- `Co-Authored-By`, `Generated-by`, `Assisted-by`, `AI-Assisted` trailers; bot
  identities. (Implemented in `internal/signal`.)
- Extend: Dependabot / Renovate / Devin / Copilot Workspace PRs; a `.grain`
  git-notes sidecar.
- Weakness: trivially omitted or gamed (`git commit` without the trailer). This
  is *why* Tier 3 exists.
- Confidence: ~0.95 (declared).

### Tier 3 — INFERRED (from the code itself · works everywhere · our science moat)
No cooperation needed; lower accuracy; hard-capped at **0.70** confidence.
- **Content classifier** — AST/lexical features + (later) perplexity under a local
  code model. *This is the current weak spot and the first thing we build.*
- **Stylometry** — per-author style baseline; deviations flag AI (opt-in).
- **Behavioral / temporal** — burst timing, diff shape (current v0 heuristic).
- Confidence: ≤ 0.70 (inferred), always.

## The self-improving loop 🔁

**Declared commits are free labels for training the inferred classifier.** A commit
with `Co-Authored-By: Claude` is a confirmed-AI training example; a human-only
commit is a human example. Each repo's declared history calibrates its inferred
model — and lets us publish *measured* per-signal accuracy (calibration report)
instead of a fake "99% detected". This ties the science directly to the
"signals, not verdicts" promise.

## Non-negotiables

- **Local-first.** Everything runs on the developer's machine; only the report
  (`grain.json`) is ever pushed. A content model computes perplexity locally and
  emits only a score. Never send source off-box.
- **Inferred is capped at 0.70.** A product principle, not a tuning constant.
- **Explainable.** Every classification can show *why* (which features/signals).
- **Reproducible.** Engine + weights id pinned in `grain.json`.
- **Calibrated over confident.** Report confidence intervals and measured accuracy.

## Prioritized backlog (by leverage)

| # | Item | Tier | Why now |
|---|------|------|---------|
| **1** | **Content classifier v1** (AST/lexical features, calibrated on declared) | 3 | Biggest immediate lift; builds on what we have; stdlib-friendly. See `content-classifier-v1.md`. |
| 2 | Self-improving loop (`grain eval` / calibrate on declared ground truth) | 3 | Turns declared data into measured accuracy; publishable trust. |
| 3 | Perplexity via local code model (`grain-ml` sidecar) | 3 | Strong content signal; heavier (optional runtime), so v2. |
| 4 | Editor telemetry integration (Copilot/Cursor accept events) | 1 | Line-level ground truth; needs plugin/API work. |
| 5 | Per-author stylometry baseline (opt-in) | 3 | Catches AI deviations; privacy-sensitive. |
| 6 | IDE plugin — authorship-time capture | 1 | The long-term moat / provenance standard. |

## Honest limits ⚠️

Content-based detection of *code* is hard and errs (like AI-text detectors). Code
is more structured than prose, which helps — but false positives are real (a
careful human writes "textbook" code; human-edited AI is a blend). That is exactly
why we cap inferred confidence, report intervals, and treat line-level **attested**
capture (Tier 1) as the eventual winner. Detection is the bridge until capture is
ubiquitous.
