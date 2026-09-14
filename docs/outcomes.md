# Outcomes — is AI-written code actually a problem here?

A percentage of AI-assisted code says nothing about whether it caused trouble.
Outcomes does: it measures how often AI-written lines are later **reworked**
(deleted or rewritten) compared to human-written lines in the same repository,
using nothing but git history and grain's own provenance. No tickets, no CI, no
external data — every repo can answer this for itself.

## Method

Every substantive added line is tracked by its content hash from the commit
that introduced it until a later commit removes it. That removal is *rework*.
Two refinements keep it honest:

- **Moves are not rework.** Content removed and re-added in the same commit
  (moved between files or functions) is still alive and is not counted.
- **Fix/revert tagging.** Rework by a commit whose subject starts with
  `fix`, `hotfix`, `bugfix`, `revert` or `Revert "` is counted separately, so
  you can see how much AI code was undone *because it was wrong* versus
  refactored in the normal course of work.

Which lines are "AI-written" comes from the same provenance tiers grain uses
everywhere: line-level attestation (`grain attest`, exact lines), attested or
declared commits (whole commit), and nothing else — inference is never used to
label a line here.

## Two cohorts

| Cohort | Lines compared | Why it exists |
|---|---|---|
| **Strict** | AI and human lines from the **same** line-attested commits | Author, style, era and review process are held constant, so a difference in rework rate is about authorship, not context. The cleanest signal. |
| **Broad** | All commits: attested/declared-AI lines vs everything else | More data, weaker labels — undeclared AI counts as human, so the AI figures are a *floor*. |

The headline uses strict whenever both sides have at least 30 lines, otherwise
broad, and says which. Below 30 lines a side grain shows the numbers but
refuses a verdict.

## Reading it

```
outcomes (strict · 745 AI lines, 116 human): AI reworked 4% vs human 12% · 0.3× as often
```

- **Reworked %** — share of lines from that side later removed.
- **In fixes** — how many of those removals were fix/revert commits.
- **Median commits until rework** — how long lines survived. Short medians with
  many fixes read very differently from long ones.
- **Ratio** — AI rate ÷ human rate. `2.0×` means AI lines were reworked twice
  as often. It is only shown when both sides have enough lines and the human
  side has some rework to compare against.

## Where it shows

- `grain scan` prints the headline line; `PROVENANCE.md` gets an **Outcomes**
  section; `grain.json` carries the full `outcomes` block (both cohorts).
- `grain push` sends it to Grain Cloud, where the repo page shows an
  **Outcomes** card. Cloud GitHub scans don't compute outcomes (they only see
  a window of diffs), and never overwrite a block pushed from the CLI.

## What it does not claim

Rework is not proof of a bug — code is rewritten for many good reasons — and
the broad cohort's labels are imperfect. This is a signal about *this*
repository's history, most trustworthy in the strict cohort, and meant to be
read alongside the fix/revert split. Signals, not verdicts.
