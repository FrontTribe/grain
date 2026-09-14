# Contributing to grain

Thanks for helping build a calmer way to see code provenance.

## Principles

- **Signals, not verdicts.** grain measures and communicates; it never accuses.
  Output stays probabilistic and non-moralizing. AI-assisted is a fact, not a flaw.
- **Record, don't guess, wherever possible.** Attested provenance (a signed git
  note written when the agent edits) beats declared (trailers, bot accounts)
  beats inferred. Inference is capped at 0.70 confidence and always labeled.
- **Honest about limits.** Attestation only covers what a hook captured; a
  signature proves who wrote a note, not that the claim is true; review
  evidence is a floor. When a number could be misread, the text next to it
  says what it doesn't mean.
- **Local-first and open.** The CLI never transmits source code. The engine is
  stdlib-only Go, and the provenance format is a public spec
  ([docs/spec/provenance-v1.md](docs/spec/provenance-v1.md)) anyone can implement.

## Development

The engine and CLI are dependency-free Go (they shell out to `git`).

```bash
make build           # build ./grain
make test            # go test ./...
make vet             # go vet ./...
./grain scan         # run against this repo
./grain verify       # check every attestation signature in this repo
```

grain Cloud lives in `web/` (Next.js, Supabase, Stripe, GitHub App):

```bash
cd web && npm install
npm run dev          # http://localhost:3000 (this repo's maintainer uses PORT=3100)
npx tsc --noEmit -p . && npm run lint && npm run build   # what CI expects to pass
```

Cloud needs a `.env.local` (Supabase keys, Stripe, GitHub App, Resend,
`GRAIN_SIGNING_KEY`); see the setup notes in `docs/` for each.

### Attest your own commits

This repository dogfoods capture-at-source. After cloning:

```bash
grain hook install   # git post-commit hook + prints the Claude Code hook config
grain key            # creates your Ed25519 signing key on first use
```

The Claude Code hook is already in `.claude/settings.json`. From then on every
commit you make with an agent carries a signed note with the exact AI-written
lines, and `grain verify` passes on it. Commits without the hook are fine too:
their lines are shown as human, never claimed as AI.

## Layout

```
cmd/grain/           CLI entry + command dispatch
internal/gitlog/     commit history, diffs and notes via the git binary
internal/signal/     declared + attested authorship signals
internal/features/   lexical features of added code
internal/classify/   the content classifier (logistic; per-repo calibration)
internal/score/      per-commit scoring (attested > declared > inferred, capped)
internal/outcomes/   rework tracking by line hash (Outcomes)
internal/risk/       AI lines in critical paths without review evidence (Risk)
internal/sign/       Ed25519 signatures for notes and BOMs (provenance v1)
internal/report/     grain.json, PROVENANCE.md, badge, terminal, PR markdown
internal/config/     .grain.toml loader
web/src/lib/         Cloud engine mirrors: classify.ts, risk.ts, signing.ts, bom.ts
docs/                specs, method notes, setup guides
```

Two things are implemented twice, in Go and TypeScript, and must stay
byte-identical: the line hash (`outcomes.LineHash` / `risk.ts lineHash`) and
canonical JSON for BOM digests (`sign.Canonical` / `bom.ts canonical`).
`internal/sign/sign_test.go` verifies a Cloud-signed BOM for exactly this
reason; if you touch either side, keep that test green.

## Pull requests

- Keep changes focused; add a test when you change scoring, signals, hashing
  or signing.
- `go vet ./...` and `go test ./...` must pass; for `web/`, `tsc`, `eslint`
  and `next build` must pass. CI enforces the Go side and grain runs on its
  own PRs, so expect a provenance comment.
- Copy in the product (landing page, app, emails) uses plain punctuation:
  no em dashes, sentence case, specific words. Match the surrounding voice.
- Don't commit `.grain/ai-edits.jsonl`, `.grain/model.json` or any signing key.

## Adding an AI-agent signal

New agents are recognized by name in `internal/config` (`Agents`) and matched in
`internal/signal`. If you use an assistant that leaves a `Co-Authored-By` or
`Generated-by` trailer, add its identifier there.

## Adding a capture hook for another agent

`grain hook claude` reads a Claude Code PostToolUse event and appends the
edited lines, as content hashes, to `.grain/ai-edits.jsonl` (one JSON object
per line: `{"file": "<repo-relative path>", "hashes": ["<10 hex>", …]}`). Any
tool that can run a command after writing a file can do the same: add a
`grain hook <agent>` subcommand in `cmd/grain/provenance.go` that parses that
tool's event and calls `appendLedger`. `grain attest` does the rest.
