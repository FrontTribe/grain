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

## Gating a pull request

`grain check` lists every dependency the change set added in the PR comment,
with the registry answer when it was consulted (`--check-registry`, or
`check_registry: true` in the Action, the default there). The gate is a
`.grain.toml` choice:

```toml
[policy]
dependencies = "warn"    # default: listed, exit code unchanged
dependencies = "block"   # fails the check; implies the registry lookup
dependencies = "off"     # not evaluated in check
```

It fires on a package the registry does not know, whoever added it, and on a
package younger than 30 days that an **AI-written** line added. New packages
happen; a new package an agent reached for is the one to look at before it
is installed everywhere. With `fail_on: policy` in the Action, "block" is a
failed commit status a branch rule can require.

Grain Cloud emails the workspace admins (Team plan) when a push to the default
branch adds a package the registry does not know.

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
