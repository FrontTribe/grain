# 🌾 grain

**See the grain of your codebase — how it was made, not just what it is.**

Grain is a code-provenance layer. It reads a git history and shows how much of a
repository was human-written, how much was AI-assisted, and whether changes
followed the project's own rules — with a confidence level on every claim.

> **Signals, not verdicts.** Grain is a transparency tool for cooperative repos.
> It is *not* an anti-cheat or plagiarism detector, and never claims certainty
> from inference.

---

## Why

Two trends collided in 2026: AI agents now commit directly to repos, and
maintainers have grown wary of undeclared AI code. The gap between them is
**trust** — and trust needs measurement. Grain is the instrument.

## What it outputs

One input (a repo or a diff), three outputs:

- **A badge** — a README shield showing the repo's human/AI mix.
- **A PR check** — a calm, itemized comment from `grain[bot]` on each PR.
- **`PROVENANCE.md`** — a committable "nutrition label" for the whole repo,
  backed by a machine-readable `grain.json`.

## How it works

The detection engine extracts **signals** from each commit, ranked by confidence:

1. **Declared** (high confidence) — `Co-Authored-By:` trailers, bot accounts,
   explicit `Generated-by:` / `Assisted-by:` tags, self-declaration labels.
2. **Inferred** (capped confidence) — diff uniformity, burst timing, message
   style, net-new vs incremental edits.
3. **Contextual** (attention, not classification) — CODEOWNERS checks,
   convention deviation.

Declared signals dominate. Inference is deliberately weak and clearly labeled —
it protects real humans who happen to write clean code.

## Status

**v0.1 skeleton — `grain scan` works.** The Go CLI reads real git history
(no external dependencies; it shells out to `git`) and classifies commits.
Working commands: `scan`, `check`, `badge`, `explain`, `init`, `version`.
Next: convention diffing, the GitHub Action, and richer inference.

## Quickstart

```bash
go build -o grain ./cmd/grain     # or: make build
./grain scan                      # writes PROVENANCE.md + grain.json
```

Example (grain scanning its own repo — every commit is Co-Authored-By Claude):

```
grain 0.1.0 · scanning kresimirgalic/grain
  reading 3 commits done
  provenance:
    human-authored    0%  ░░░░░░░░░░░░░░░░░░░░
    ai-assisted     100%  ████████████████████
    unclassified      0%  ░░░░░░░░░░░░░░░░░░░░
  wrote PROVENANCE.md · grain.json
```

Other commands:

```bash
./grain check --range main..HEAD   # gate a change set; exit 1 on attention
./grain explain <sha>              # why a commit was classified as it was
./grain badge                      # shields.io endpoint JSON
./grain init                       # write an example .grain.toml
```

### Layout

```
cmd/grain/         CLI entry + command dispatch
internal/gitlog/   reads commit history via the git binary
internal/signal/   extracts declared + inferred authorship signals
internal/score/    scores each commit (declared high-confidence; inference capped at 0.70)
internal/report/   aggregates + renders grain.json, PROVENANCE.md, badge, terminal
internal/config/   loads .grain.toml
```

## Docs

The full design work lives in [`docs/`](./docs) (open the HTML files in a browser):

| Doc | What it is |
|-----|------------|
| [`docs/concept.html`](./docs/concept.html) | The concept pitch — problem, outputs, launch. |
| [`docs/product-spec.html`](./docs/product-spec.html) | Full product specification (engine, CLI, schema, roadmap). |
| [`docs/design-system.html`](./docs/design-system.html) | Visual design system — tokens, type, components, voice. |

Design tokens as plain CSS: [`design/tokens.css`](./design/tokens.css).

## Tech (planned)

- **Language:** Go (single static binary; `go-git` for history).
- **Distribution:** Homebrew / `go install` / curl script + a thin `npx grain` wrapper.
- **Surface:** GitHub-first (Action + PR check), git-native core so other forges follow.

## Open core

| Tier | Price | Includes |
|------|-------|----------|
| **grain CLI** | MIT · free | CLI, Action, badge, `PROVENANCE.md`, full engine — runs locally. |
| **grain Cloud** | $ / seat | Org dashboard, trends, merge-policy engine, multi-repo. |
| **grain Audit** | $$ | Signed provenance ledger, EU AI Act / SOC2 export, SSO, on-prem. |

Everything that runs on a single repo, locally, is free and MIT. The open engine
is what makes the numbers credible.

## License

Core is [MIT](./LICENSE).
