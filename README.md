<div align="center">

<img src="docs/mark.svg" alt="grain" width="72" height="72">

# grain

**See the grain of your codebase — how it was made, not just what it is.**

[![CI](https://github.com/kresimirgalic/grain/actions/workflows/ci.yml/badge.svg)](https://github.com/kresimirgalic/grain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1F6E5B)](LICENSE)
![Go 1.23+](https://img.shields.io/badge/Go-1.23%2B-1F6E5B)
![grain 100% AI-assisted](https://img.shields.io/badge/%F0%9F%8C%BE_grain-100%25_AI--assisted-B0511C)
[![Stars](https://img.shields.io/github/stars/kresimirgalic/grain?color=6B655B&label=stars)](https://github.com/kresimirgalic/grain/stargazers)

</div>

Grain is a **code-provenance layer**. It reads a git history and reports how much
of a repository was human-written vs AI-assisted, and whether changes followed
the project's own rules — with a confidence level on every claim.

> **Signals, not verdicts.** Grain is a transparency tool for cooperative repos.
> It is *not* an anti-cheat or plagiarism detector, and never claims certainty
> from inference. (Yes — grain reports its *own* repo as 100% AI-assisted, because
> every commit is `Co-Authored-By: Claude`. It doesn't pretend otherwise.)

---

## Demo

```console
$ grain scan
grain 0.1.0 · scanning kresimirgalic/grain
  reading 8 commits done
  provenance:
    human-authored    0%  ░░░░░░░░░░░░░░░░░░░░
    ai-assisted     100%  ████████████████████
    unclassified      0%  ░░░░░░░░░░░░░░░░░░░░
  wrote PROVENANCE.md · grain.json

$ grain explain HEAD
ab1e0fa  ai_authored · conf 0.95 · basis declared
  subject: Add Show HN launch plan (LAUNCH.md + docs/launch.html)
  churn:   612 lines across 3 files
  signal:  Co-Authored-By: claude
```

<!-- After recording the GIF (see below), uncomment:
![grain scan demo](docs/demo.gif)
-->

> **Record the GIF:** `grain` on your PATH + [VHS](https://github.com/charmbracelet/vhs), then
> `vhs docs/demo.tape` → writes `docs/demo.gif`. Uncomment the line above to embed it.

## Quickstart

```bash
go build -o grain ./cmd/grain     # or: make build
./grain scan                      # writes PROVENANCE.md + grain.json
```

Other commands:

```bash
./grain check --range main..HEAD   # gate a change set; exit 1 on attention
./grain explain <sha>              # why a commit was classified as it was
./grain badge                      # shields.io endpoint JSON
./grain init                       # write an example .grain.toml
```

## What it outputs

One input (a repo or a diff), three outputs — grain meets you where you already look.

### 1. A README badge

```markdown
![grain](https://img.shields.io/endpoint?url=https://YOUR_HOST/grain.json)
```

`grain badge` emits the [shields.io endpoint](https://shields.io/badges/endpoint-badge)
JSON. Point the badge at a hosted `grain.json` (commit it, or publish it from CI)
and it renders the repo's human/AI mix — the way a coverage badge renders tests.
No service to run.

### 2. A PR check

The GitHub Action posts a calm, itemized comment from `grain[bot]`:

```
grain report · #482
› 62% of +214 lines carry AI-authorship signals  (1 Co-Authored-By: Claude)
› 2 files touch src/auth/ — human-owned per CODEOWNERS
› convention check: 3 deviations from repo style
policy: AI share > 40% in a human-owned path → 1 human review requested
```

### 3. `PROVENANCE.md`

A committable, diff-friendly "nutrition label" for the whole repo — repo-level
mix, a per-directory breakdown, and the engine version — backed by a
machine-readable `grain.json`.

## How it works

Grain extracts **signals** from each commit, ranked by confidence:

| Tier | Signals | Confidence |
|------|---------|------------|
| **Declared** | `Co-Authored-By:` trailers, bot accounts, `Generated-by:` / `AI-Assisted:` tags | high (up to 0.95) |
| **Inferred** | diff uniformity, burst timing, greenfield vs edit, message style | capped at **0.70** |
| **Contextual** | CODEOWNERS (human-owned paths), convention deviation | attention flag, not a score |

Declared signals dominate. Inference is deliberately weak and clearly labeled —
it protects real humans who happen to write clean code. Scores aggregate from
commit → file → directory → repo, weighted by lines changed, and every score is
reproducible from the engine + weights version pinned in `grain.json`.

## GitHub Action

Add `.github/workflows/grain.yml` to comment on every PR (and optionally gate it):

```yaml
name: Grain
on: pull_request
permissions:
  contents: read
  pull-requests: write   # to post the sticky comment
jobs:
  provenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # grain needs base..head history
      - uses: kresimirgalic/grain@v1
        with:
          fail_on: never        # comment only; "policy" fails the check on attention
```

Inputs: `fail_on` (`never` | `policy`), `comment`, `range`, `config`, `go-version`.
The comment is a single sticky comment that updates in place. This repo dogfoods
it — see [`.github/workflows/grain.yml`](./.github/workflows/grain.yml).

## Configuration

`grain init` writes an example `.grain.toml`:

```toml
[policy]
ai_threshold = 0.40
human_owned  = ["src/auth/**", "src/payments/**"]

[detection]
inference   = true
local_model = "off"
agents      = ["claude", "copilot", "cursor", "codex", "devin"]

[report]
badge  = "mix"
output = "PROVENANCE.md"
```

## Open core

| Tier | Price | Includes |
|------|-------|----------|
| **grain CLI** | MIT · free | CLI, Action, badge, `PROVENANCE.md`, full engine — runs locally. |
| **grain Cloud** | $ / seat | Org dashboard, trends, merge-policy engine, multi-repo. |
| **grain Audit** | $$ | Signed provenance ledger, EU AI Act / SOC2 export, SSO, on-prem. |

Everything that runs on a single repo, locally, is free and MIT. The open engine
is what makes the numbers credible.

## Honest limits

Grain is built to be trustworthy, not omniscient. It says so plainly:

- **It can be defeated** by stripping a `Co-Authored-By` trailer. Grain measures
  the honest signal that exists; it is not an adversarial anti-cheat.
- **Inference is a hint, not proof.** It's capped at 0.70 confidence and always
  labeled `inferred` — a clean human commit reads as human.
- **It is not a dev-surveillance tool.** No per-developer leaderboard; defaults
  are comment-only, never a merge block.

## Layout

```
cmd/grain/         CLI entry + command dispatch
internal/gitlog/   reads commit history via the git binary
internal/signal/   declared + inferred authorship signals
internal/score/    per-commit scoring (declared high-confidence; inference capped)
internal/report/   grain.json, PROVENANCE.md, badge, terminal, PR markdown
internal/config/   .grain.toml loader
```

## Design &amp; docs

- [`docs/concept.html`](./docs/concept.html) — concept pitch
- [`docs/product-spec.html`](./docs/product-spec.html) — full product specification
- [`docs/design-system.html`](./docs/design-system.html) — visual design system
- [`design/brand/`](./design/brand) — brand guidelines · [`design/product/`](./design/product) — full product design (auth, dashboard, landing)
- [`site/`](./site) — landing page · [`LAUNCH.md`](./LAUNCH.md) — Show HN launch plan

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). `go vet ./...` and `go test ./...` must
pass (CI enforces this), and grain runs on its own PRs — expect a provenance comment.

## License

Core is [MIT](./LICENSE).
