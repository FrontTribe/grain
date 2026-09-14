# Security — dangerous-looking lines, with provenance

Vibe coding's failure mode isn't "the AI wrote a lot of code"; it's the one
line that disables TLS verification, concatenates user input into a shell
command, or pastes a live token, landing in `auth/` with nobody looking.
Scanners can find such lines. What they can't tell you is **whether an AI
wrote it and whether anyone reviewed it**. grain can, because it already
knows both.

## What it is, and isn't

grain runs a deliberately small, conservative set of line patterns over the
lines a commit added and joins every hit with its provenance:

- **AI-written or not** (attested line by line, or a declared commit; inference
  is never used here),
- **review evidence or not** (the same rule as [Risk](risk.md)),
- **critical path or not** (auth, billing, workflows, migrations, …, plus your
  `human_owned` paths).

It is **not** a vulnerability scanner. A finding means "this line looks like
X"; the report says so next to every number. Keep Semgrep, CodeQL, gitleaks.
grain answers the question they can't: *of the things that look dangerous,
which did an agent write, and did a human look?*

## Patterns

Secrets (AWS, GitHub, OpenAI-style, Slack, Stripe keys; private key blocks;
credential-looking literals assigned to secret-named variables), TLS
verification disabled, shell commands built from strings, `eval`, SQL built
by concatenation or f-strings, raw HTML injection, unsafe deserialization
(`pickle`, `yaml.load` without a safe loader, `unserialize`), world-writable
permissions, CORS open to any origin, MD5/SHA-1 for passwords,
`Math.random` for secrets, `--no-verify`, wildcard IAM, debug mode in code,
a committed `.env` file.

The full list, with the regular expressions, is
[`internal/security/patterns.json`](../internal/security/patterns.json). The
Cloud scanner runs the identical file (a Go test keeps the copies equal).
Comment lines, lines that *define* such a pattern (a linter config, grain's
own source) and test/fixture paths are never findings. Secrets are redacted
in every output: the first six characters, then `…`.

## Where it shows

**In the agent's loop.** `grain hook claude` sees every edit Claude Code
makes. When a written line trips a pattern it returns a PostToolUse
`additionalContext` message, so the model reads, seconds after writing it:

> grain security: the edit you just made contains lines that match a danger
> pattern. If this is intended, leave it; otherwise fix it before committing.
> - web/src/lib/client.ts: TLS verification disabled (tls.verification-disabled): `https.request({ rejectUnauthorized: false })`. Certificate checks are turned off, so any network hop can impersonate the server. Fix the trust store instead.

That is the cheapest possible moment to fix it, and the agent usually does.

**At commit.** `grain attest` (the post-commit hook) prints a warning to
stderr when any of the AI-written lines it just attested match a pattern,
quiet mode or not.

**In the report.** `grain scan` prints a `security:` line; `PROVENANCE.md`
gets a **Security** section (per-pattern counts split AI/human, findings
worst first: AI-written, unreviewed, critical path); `grain.json` carries
the `security` block; `grain push` sends it to Cloud.

**In Cloud.** GitHub scans compute the same block over their window, reusing
the review evidence from the PR API, and the repo page shows a **Security**
card.

## Reading it

```
security: 3 signals, 2 in AI-written lines, 2 of those unreviewed (1 in critical paths) · tls.verification-disabled 2, secret.github-token 1
```

Findings rank AI-written + unreviewed + critical path first, then severity.
`ai_critical_unreviewed` is the headline: dangerous-looking lines an agent
wrote, in a sensitive path, that nobody has evidence of reviewing.

## What it deliberately does not claim

- A match is a shape, not a verdict. `Access-Control-Allow-Origin: *` on a
  public keys endpoint is correct; grain's own repository reports exactly that
  finding, and it stays.
- Absence of a finding means none of these patterns matched, nothing more.
- Absence of review evidence means git and GitHub can't show a review, not
  that nobody looked.
- Human-written findings are reported too (the `human` counts), without the
  emphasis: the point is not to grade people.

Signals, not verdicts.
