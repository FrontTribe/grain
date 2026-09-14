# Content classifier calibration (M3)

**Question:** can we calibrate the inferred content classifier from *declared*
commits used as labels — Co-Authored-By an AI agent = AI (1), otherwise human (0)?

**Short answer:** a single *global* fit does **not** generalize — the declared
signal is confounded with codebase style/maturity. But *per-repo* calibration
works well, so that's what grain ships: `grain calibrate` fits a repo's own
weights from its own history.

---

## Method

- 12 repositories: AI-heavy ones (small projects using Claude/Cursor/Copilot with
  co-author trailers) and mature human libraries (Flask, requests, gin, sinatra,
  express).
- Per commit: aggregate the 10 lexical features over its added lines
  (line-weighted), label from the declared signal. Skip trivial diffs (<5 lines).
- 9,301 labeled commits (AI 2,336 · human 6,965).
- Fit: L2-regularized logistic regression (`classify.Fit`), class-balanced.
- Two evaluations: a random pooled split, and **leave-repos-out** (train on some
  repos, test on repos never seen in training).

## Results

| Evaluation | DefaultModel AUC | Fitted AUC |
|---|---:|---:|
| Pooled random split (in-distribution) | 0.45 | **0.65** |
| **Leave-repos-out** (unseen repos) | 0.40 | **0.26** |
| Within-repo held-out — gin | 0.56 | **0.87** |
| Within-repo held-out — aa-dash | 0.32 | **0.84** |
| Within-repo held-out — hex-dev | 0.47 | **0.70** |

The pooled fit looks great (AUC 0.45 → 0.65, ECE 0.22 → 0.05) but that split lets
the model see each repo in both train and test. Under **leave-repos-out** the
fitted model collapses to 0.26 — *below chance*. The globally-fitted weights come
out mostly negative on `comment_density` and `docstring_completeness`, the
opposite of the hand-set prior, because in this corpus the "human" negatives are
mature, heavily-documented libraries and the "AI" positives are sparse small
apps. The classifier learns **"mature library vs small app," not "human vs AI."**

Within a single repo, where style is held constant, the same declared labels are
a usable target: held-out AUC 0.70–0.87.

## Decisions

1. **Do not ship globally-refit weights.** They improve in-distribution metrics
   but don't generalize and encode a maturity confound. The built-in
   `DefaultModel` stays a conservative prior, and the inferred tier stays capped
   at 0.70 and labelled a guess.
2. **Ship per-repo calibration.** `grain calibrate` fits a repo's own weights
   from its declared history and writes `.grain/model.json`; the scorer loads it
   (`config.loadModel` → `score.modelFor`) and reports `w2-content-fit/f1`. This
   is the self-improving loop M3 set out to build, now closed end-to-end.
3. **The Cloud scan** uses the global default prior for the inferred tier (no
   per-repo history to fit from at connect time). Its high-confidence tiers
   (attested, declared) carry the weight; inferred stays a hedged estimate.

## Caveats

- Declared labels are weak supervision: undeclared-AI commits pollute the human
  class, so measured AUC is a floor, not the truth.
- `grain calibrate` needs both classes present (≥8 each) — a repo that never
  declares AI can't calibrate this way.
- Reproduce with `grain eval --fit -C <repo>` (per repo) or `grain calibrate`.
