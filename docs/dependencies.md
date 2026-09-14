# Dependencies — what AI-written code pulled in, and whether it exists

Agents hallucinate package names. When a name doesn't exist, someone can
register it (slopsquatting), and the next agent that hallucinates the same
name installs their code. The fix starts with knowing which dependencies an
agent added, whether a human looked, and whether the package is real.

## What grain does

For every commit in range, grain reads the **added lines of dependency
manifests** (`package.json`, `go.mod`, `requirements*.txt`, `pyproject.toml`,
`Cargo.toml`, `Gemfile`) and extracts the packages they introduce. Each one is
joined with provenance the same way Risk and Security are: AI-written line or
not (attested hash, or a declared commit), review evidence or not. A
dependency is attributed to the commit that first added it.

With `--check-registry` (CLI) or always (Cloud), grain asks the package's
registry two things: **does it exist**, and **when was it created**. npm,
PyPI, the Go module proxy, crates.io and RubyGems are supported. Only the
package name is sent; the CLI is local-first, so this is opt-in there.

## Reading it

```
deps: 19 added, 16 by AI (16 unreviewed) · registry: 0 not found, 0 younger than 30 days
```

- **not found**: the name is not on its registry. Either a typo, a private
  package, or a hallucination. The last one is the slopsquatting seed: look
  before it gets registered by someone else.
- **younger than 30 days**: the package exists but is new. Legitimate new
  packages exist; so do names registered last week to catch a hallucination.
  Worth a look when an agent added it.

`PROVENANCE.md` gets a **Dependencies** table (package, ecosystem, who added
it, review evidence, registry answer with age); `grain.json` carries the
`dependencies` block; Cloud shows a **Dependencies** card on the repo page,
computed over its scan window with the registries consulted.

## What it deliberately does not claim

- Existence is not safety. A package that exists can still be malicious;
  grain does not audit package contents. Use your dependency scanner for that.
- Private registries and workspace packages show as "not found" on the
  public registry; that is a fact about where grain looked, not about the
  package.
- Manifest parsing is line-based and deliberately simple; lock files are
  ignored, and a dependency only counts when a manifest line adding it is in
  the range.

Signals, not verdicts.
