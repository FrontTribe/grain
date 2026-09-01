# grain

Run [Grain](https://github.com/kresimirgalic/grain) — the code-provenance CLI —
with no manual install:

```bash
npx grain scan
```

This package is a thin launcher. On first run it downloads the prebuilt Grain
binary for your platform (macOS / Linux / Windows · amd64 / arm64) from the
project's GitHub Releases and execs it. The engine is dependency-free Go and runs
entirely locally — your code never leaves your machine.

> **Signals, not verdicts.** Grain measures how much of a repo is human-written
> vs AI-assisted, with a confidence level on every claim. It is not an anti-cheat.

Prefer a native install? `go install github.com/kresimirgalic/grain/cmd/grain@latest`,
Homebrew, or a release binary — see the [main README](https://github.com/kresimirgalic/grain).

MIT licensed.
