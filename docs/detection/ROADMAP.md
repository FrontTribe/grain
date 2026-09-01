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
- **✅ git-notes attestation shipped**: `grain annotate <sha> --ai|--human|--assisted`
  writes an authoritative `Provenance:` note on `refs/notes/grain`; scanning reads
  it as the top tier (basis `attested`), overriding message trailers and inference.
  Provenance lives in git — portable, versioned, tool- or human-written.
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

| # | Item | Tier | Status / why |
|---|------|------|---------|
| **1** | **Content classifier v1** (lexical features, logistic, calibrated) | 3 | ✅ **shipped** (opt-in, unvalidated). `internal/features` + `internal/classify` + `grain eval`. See `content-classifier-v1.md`. |
| 2 | Self-improving loop (`grain eval --fit` → persist per-repo weights) | 3 | Harness ✅; persisting fitted weights waits on balanced data (else it overfits). |
| 3 | **Expand DECLARED detection** (bot/agent PRs, git-notes sidecar) | 2 | **Reprioritized up** — cheap, high-accuracy; where the signal actually is. (Fixed `*[bot]` glob matching.) |
| 4 | Perplexity via local code model (`grain-ml` sidecar) | 3 | Strong content signal; heavier (optional runtime), so v2. |
| 5 | Editor telemetry integration (Copilot/Cursor accept events) | 1 | Line-level ground truth; needs plugin/API work. |
| 6 | Per-author stylometry baseline (opt-in) | 3 | Catches AI deviations; privacy-sensitive. |
| 7 | IDE plugin — authorship-time capture | 1 | The long-term moat / provenance standard. |

**Learning from v1 (M5):** pure Tier-3 content inference hit a ceiling on
AI-*assisted* (human-edited) code, and balanced labeled data is scarce. So the
next leverage is **not** more Tier-3 machinery but **Tier 2 (declared) breadth**
and **Tier 1 (attested) capture** — where accuracy is cheap and honest.

## Honest limits ⚠️

Content-based detection of *code* is hard and errs (like AI-text detectors). Code
is more structured than prose, which helps — but false positives are real (a
careful human writes "textbook" code; human-edited AI is a blend). That is exactly
why we cap inferred confidence, report intervals, and treat line-level **attested**
capture (Tier 1) as the eventual winner. Detection is the bridge until capture is
ubiquitous.
