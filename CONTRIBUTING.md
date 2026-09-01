# Contributing to grain

Thanks for helping build a calmer way to see code provenance.

## Principles

- **Signals, not verdicts.** grain measures and communicates; it never accuses.
  Output stays probabilistic and non-moralizing. AI-assisted is a fact, not a flaw.
- **Honest about limits.** Inference is capped at 0.70 confidence and clearly
  labeled. Declared signals are always preferred over inference.
- **Local-first.** The CLI never transmits source code.

## Development

grain is dependency-free Go (it shells out to `git`).

```bash
make build     # build ./grain
make test      # go test ./...
make vet       # go vet ./...
./grain scan   # run against this repo
```

## Layout

```
cmd/grain/         CLI entry + command dispatch
internal/gitlog/   reads commit history via the git binary
internal/signal/   declared + inferred authorship signals
internal/score/    per-commit scoring (declared high-confidence; inference capped)
internal/report/   grain.json, PROVENANCE.md, badge, terminal, PR markdown
internal/config/   .grain.toml loader
```

## Pull requests

- Keep changes focused; add a test when you change scoring or signals.
- `go vet ./...` and `go test ./...` must pass (CI enforces this).
- grain runs on its own PRs — expect a provenance comment.

## Adding an AI-agent signal

New agents are recognized by name in `internal/config` (`Agents`) and matched in
`internal/signal`. If you use an assistant that leaves a `Co-Authored-By` or
`Generated-by` trailer, add its identifier there.
