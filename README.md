<div align="center">

<img src="docs/mark.svg" alt="grain" width="72" height="72">

# grain

**See the grain of your codebase — how it was made, not just what it is.**

[![CI](https://github.com/FrontTribe/grain/actions/workflows/ci.yml/badge.svg)](https://github.com/FrontTribe/grain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1F6E5B)](LICENSE)
![Go 1.23+](https://img.shields.io/badge/Go-1.23%2B-1F6E5B)
![grain 97% AI-assisted](https://img.shields.io/badge/%F0%9F%8C%BE_grain-97%25_AI--assisted-B0511C)
[![Stars](https://img.shields.io/github/stars/FrontTribe/grain?color=6B655B&label=stars)](https://github.com/FrontTribe/grain/stargazers)

</div>

Grain is a **code-provenance layer**. It records which lines an AI agent wrote
as it writes them, signs that into git, and reports how much of a repository is
human-written vs AI-assisted, where the AI-written code landed, and whether
anyone reviewed it — with a confidence level on every claim.

> **Signals, not verdicts.** Grain is a transparency tool for cooperative repos.
> It is *not* an anti-cheat or plagiarism detector, and never claims certainty
> from inference. (Yes — grain reports its *own* repo as 97% AI-assisted: nearly
> every commit is `Co-Authored-By: Claude`, and since the hook landed the exact
> lines are attested. It doesn't pretend otherwise.)

---

## Demo

```console
$ grain scan
grain 0.1.0 · scanning FrontTribe/grain
  reading 99 commits done
  provenance:
    human-authored    3%  █░░░░░░░░░░░░░░░░░░░
    ai-assisted      97%  ███████████████████░
    unclassified      0%  ░░░░░░░░░░░░░░░░░░░░
  outcomes (strict · 4259 AI lines, 370 human): AI reworked 8% vs human 18% · 0.47× as often
  risk: 449 AI lines in critical paths, 449 (100%) without review evidence · workflows 155, auth 129, login 107
  wrote PROVENANCE.md · grain.json

$ grain explain HEAD
ced1ed8  ai_authored · conf 0.95 · basis attested
  subject: feat(web): connect and first-scan pages share the setup flow shell
  churn:   213 lines across 4 files
  signal:  Co-Authored-By: claude
  signal:  note: Provenance assisted

$ grain verify
grain verify — 99 commits, 21 attested
  signed, valid    12
  signed, invalid   0
  unsigned          9
  ✓ every attestation checks out
```

## Install

**macOS / Linux** — one line:

```bash
curl -fsSL https://raw.githubusercontent.com/FrontTribe/grain/main/install.sh | sh
```

**Homebrew** (macOS / Linux):

```bash
brew install FrontTribe/tap/grain
```

**Windows** (Scoop):

```powershell
scoop bucket add fronttribe https://github.com/FrontTribe/scoop-bucket
scoop install grain
```

**Any platform** — via npm, or Go:

```bash
npx grain scan
go install github.com/FrontTribe/grain/cmd/grain@latest
```

Or grab a binary from [Releases](https://github.com/FrontTribe/grain/releases).
Then:

```bash
grain scan                        # writes PROVENANCE.md + grain.json
```

## Build from source

```bash
go build -o grain ./cmd/grain     # or: make build
./grain scan
```

Other commands:

```bash
grain check --range main..HEAD   # gate a change set; exit 1 on attention or a blocking gate
grain explain <sha>              # why a commit was classified as it was
grain badge                      # shields.io endpoint JSON
grain init                       # write an example .grain.toml

grain hook install               # capture AI edits at the source (git post-commit + Claude Code hook)
grain attest                     # attest HEAD's AI-written lines from the edit ledger (runs from the hook)
grain annotate <sha> --ai        # attest a commit by hand (--human, --assisted)
grain blame <file>               # git blame for AI: which lines were AI-written
grain key                        # show (or create) the Ed25519 key your attestations are signed with
grain verify [--strict]          # check every attestation signature in the repo
grain verify --bom report.json   # check a signed authorship report offline

grain calibrate                  # fit the content classifier to this repo (.grain/model.json)
grain eval                       # score the classifier against declared commits
grain push                       # send grain.json to grain Cloud
```

## What it outputs

One input (a repo or a diff), four outputs — grain meets you where you already look.

### 1. A README badge

```markdown
![grain](https://img.shields.io/endpoint?url=https://YOUR_HOST/grain.json)
```

`grain badge` emits the [shields.io endpoint](https://shields.io/badges/endpoint-badge)
JSON. Point the badge at a hosted `grain.json` (commit it, or publish it from CI)
and it renders the repo's human/AI mix — the way a coverage badge renders tests.
No service to run.

### 2. A PR check

The GitHub Action posts one calm, itemized sticky comment: the AI share per
path, one line per thing your policy noticed, then the security findings and
the dependencies the change added. This is the comment it left on a test PR
in this repository:

```
Provenance report · PR #3
100% AI-assisted · 1 commit, 11 lines changed
sandbox/                     0% human · 100% AI

policy  change set above the 40% AI threshold → review suggested
policy  1 security finding in AI-written lines → a human should look
policy  1 added dependency not on the registry → a human should look

security      7b49393 sandbox/fetch.py   TLS verification disabled (high)   AI
dependencies  leftpadd-utilz   pypi   AI   not found
              requests         pypi   AI   5691 days old
```

Every gate is opt-in: `fail_on: policy` in the workflow, and `security` /
`dependencies = "block"` in `.grain.toml` (defaults `warn`). A blocking gate
fails the `grain/provenance` status a branch rule can require; a maintainer
can still merge.

### 3. `PROVENANCE.md`

A committable, diff-friendly "nutrition label" for the whole repo — repo-level
mix, a per-directory breakdown, **Outcomes** (how often AI-written lines get
reworked vs human lines from the same commits, [docs](docs/outcomes.md)),
**Risk** (AI-written lines in critical paths with no review evidence, down to
the commits, [docs](docs/risk.md)), **Security** (added lines that look
dangerous, joined with who wrote them and whether anyone reviewed them,
[docs](docs/security.md)), **Dependencies** (what AI-written lines pulled in,
and with `--check-registry` whether each package exists and how old it is:
the slopsquatting check, [docs](docs/dependencies.md)) and the engine
version — backed by a machine-readable `grain.json`.

### 4. Signed attestations

When an AI agent writes code, `grain hook` records it and `grain attest` writes
a **signed** note on the commit: exactly which lines, by content hash, signed
with your Ed25519 key and bound to that commit. `grain verify` checks every
note in a repo; anyone can — the format is open
([provenance v1](docs/spec/provenance-v1.md)), stdlib-only, and needs no
service. Cloud authorship reports are signed the same way and checked at
[getgrain.dev/verify](https://getgrain.dev/verify).

The same hook watches for the lines that make vibe coding dangerous: a pasted
token, `rejectUnauthorized: false`, a shell command built from input, SQL by
concatenation. When Claude Code writes one, grain tells the agent
immediately, before the commit; when one is committed anyway, `grain attest`
warns; and every report says which of these lines an AI wrote and whether
anyone reviewed them ([docs](docs/security.md)).

## How it works

Grain extracts **signals** from each commit, ranked by confidence:

| Tier | Signals | Confidence |
|------|---------|------------|
| **Attested** | a signed git note (`refs/notes/grain`) written by `grain attest` or `grain annotate`: exactly which lines, by content hash ([capture at source](docs/provenance-capture.md)) | ground truth (0.95) |
| **Declared** | `Co-Authored-By:` trailers, bot accounts, `Generated-by:` / `AI-Assisted:` tags | high (up to 0.95) |
| **Inferred** | code content (a lexical classifier, [per-repo calibrated](docs/detection/calibration-study.md)), diff uniformity, burst timing, message style | capped at **0.70** |
| **Contextual** | CODEOWNERS (human-owned paths), critical paths, review evidence | attention flag, not a score |

Attested beats declared beats inferred. Inference is deliberately weak and
clearly labeled — it protects real humans who happen to write clean code. Scores
aggregate from commit → file → directory → repo, weighted by lines changed (a
line-attested commit counts by its true AI share), and every score is
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
      - uses: FrontTribe/grain@v1
        with:
          fail_on: never        # comment only; "policy" fails the check on attention
```

Inputs: `fail_on` (`never` | `policy`), `comment`, `range`, `config`,
`check_registry`, `request_review`, `reviewers`, `status_check`, `go-version`.
The PR comment carries the security findings and the dependencies the change
added (with the registry answer). `security = "block"` and `dependencies =
"block"` in `.grain.toml` make `grain check` fail on AI-written security
findings or on packages the registry does not know; with `fail_on: policy`
that blocks the merge. Defaults are `warn`: shown, never blocking.
The comment is a single sticky comment that updates in place. This repo dogfoods
it — see [`.github/workflows/grain.yml`](./.github/workflows/grain.yml).

## Configuration

`grain init` writes an example `.grain.toml`:

```toml
[policy]
ai_threshold = 0.40
human_owned  = ["src/auth/**", "src/payments/**"]
# critical   = ["auth", "billing", "workflows"]   # override the built-in critical-path list (see docs/risk.md)
security     = "warn"   # grain check: AI-written security findings → "off" | "warn" | "block"
dependencies = "warn"   # grain check: packages not on the registry, or young and AI-added → "off" | "warn" | "block"

[detection]
inference          = true
content_classifier = true    # score inferred commits from code content (false = declared-only)
local_model = "off"
agents      = ["claude", "copilot", "cursor", "codex", "devin"]
bot_authors = ["*[bot]"]

[report]
badge  = "mix"
output = "PROVENANCE.md"
```

Trusted signing keys for `grain verify --strict` live in `.grain/signers`
(`name ed25519:<public key>` per line); `grain key` prints yours.

## grain Cloud

[getgrain.dev](https://getgrain.dev) runs the same engine over your GitHub
repositories and keeps watching:

- **Scans on every push** through the GitHub App; declared and attested
  provenance from git, inferred from the code, review evidence from the
  **pull request API** (was there a PR, who approved it).
- **Risk, Outcomes, Security and Dependencies** per repository (registries
  always consulted), trends and policy across the workspace.
- **Alerts** by email when a repo crosses your AI threshold, when unreviewed
  AI-written lines land in a critical path, or when a push lands AI-written
  security findings or a package the registry does not know. Each names the
  commits; one push, at most one email per kind.
- A **signed Authorship Bill of Materials** (Ed25519, keys published at
  [`/.well-known/grain-keys.json`](https://getgrain.dev/.well-known/grain-keys.json))
  that anyone can check at [getgrain.dev/verify](https://getgrain.dev/verify) or
  offline with `grain verify --bom`.

CLI-scanned repositories reach the same dashboard with `grain push`
(Settings → Ingest tokens).

## Open core

| Tier | Price | Includes |
|------|-------|----------|
| **grain CLI** | MIT · free forever | CLI, Action, badge, `PROVENANCE.md`, signed attestations, the full engine — runs locally. |
| **Cloud Free** | $0 | 3 repositories, 3 seats: dashboard, scans on push, Risk, Outcomes, Security, Dependencies, trends, policy. |
| **Cloud Team** | $29 / workspace / month | Unlimited repositories, up to 20 seats, email alerts (threshold, risk, security, dependencies), signed authorship export. |
| **Cloud Audit** | from $199 / month | Unlimited seats, retention rules and audit exports, SSO on request, invoicing. |

Everything that runs on a single repo, locally, is free and MIT. The open engine
is what makes the numbers credible.

## Honest limits

Grain is built to be trustworthy, not omniscient. It says so plainly:

- **It can be defeated** by stripping a `Co-Authored-By` trailer. Grain measures
  the honest signal that exists; it is not an adversarial anti-cheat.
- **Inference is a hint, not proof.** It's capped at 0.70 confidence and always
  labeled `inferred` — a clean human commit reads as human.
- **It is not a dev-surveillance tool.** No per-developer leaderboard; defaults
  are comment-only, never a merge block. Every gate is something you turn on.
- **It is not a vulnerability scanner.** The security patterns and the
  registry check say where to look and who wrote it; they do not audit
  package contents or prove a line is exploitable. Keep your SAST.
- **Attestation only covers what a hook captured.** Lines written before the
  hook existed, in another editor, or by hand are shown as human, never
  claimed as AI. A valid signature proves who wrote the note and that it hasn't
  changed, not that the claim is true.
- **Review evidence is a floor.** Teams that review over chat or in pairing
  sessions leave no git trace and will look unreviewed.

## Layout

```
cmd/grain/           CLI entry + command dispatch (scan, check, hook, attest, blame, verify, push…)
internal/gitlog/     reads commit history, diffs and notes via the git binary
internal/signal/     declared + attested authorship signals
internal/features/   lexical features of added code
internal/classify/   the content classifier (logistic; per-repo calibration)
internal/score/      per-commit scoring (attested > declared > inferred, capped)
internal/outcomes/   rework tracking by line hash (Outcomes)
internal/risk/       AI lines in critical paths without review evidence (Risk)
internal/security/   danger patterns over added lines, joined with provenance (Security)
internal/deps/       dependencies added per manifest, registry existence and age (Dependencies)
internal/sign/       Ed25519 signatures for notes and BOMs (provenance v1)
internal/report/     grain.json, PROVENANCE.md, badge, terminal, PR markdown, check gates
internal/config/     .grain.toml loader
web/                 grain Cloud (Next.js, Supabase, Stripe, GitHub App)
```

## Docs

- [`docs/spec/provenance-v1.md`](./docs/spec/provenance-v1.md) — the signed provenance format (notes, line hashes, BOM)
- [`docs/provenance-capture.md`](./docs/provenance-capture.md) — `grain hook`, `attest`, `blame`
- [`docs/outcomes.md`](./docs/outcomes.md) · [`docs/risk.md`](./docs/risk.md) — what Outcomes and Risk measure, and don't
- [`docs/security.md`](./docs/security.md) · [`docs/dependencies.md`](./docs/dependencies.md) — the danger patterns and the registry check, and how the PR gates use them
- [`docs/detection/calibration-study.md`](./docs/detection/calibration-study.md) — why the content classifier is calibrated per repo

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). `go vet ./...` and `go test ./...` must
pass (CI enforces this), and grain runs on its own PRs — expect a provenance comment.

## License

Core is [MIT](./LICENSE).
