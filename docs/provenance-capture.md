# Capture-at-source provenance — `grain hook`, `grain attest`, `grain blame`

Guessing whether code is AI-written after the fact is unreliable (see the
[calibration study](detection/calibration-study.md)). Recording it **when the AI
writes it** is not. These three commands do that, with zero developer effort:
the weakest tier (inferred, capped at 0.70) becomes the strongest (attested).

## Install (once per repo)

```bash
grain hook install
```

That writes `.git/hooks/post-commit` (runs `grain attest -q` after every commit)
and prints the Claude Code hook to add to `.claude/settings.json`:

```json
{ "hooks": { "PostToolUse": [ { "matcher": "Edit|Write|MultiEdit",
  "hooks": [ { "type": "command",
    "command": "command -v grain >/dev/null 2>&1 && grain hook claude || true" } ] } ] } }
```

The command is guarded, so a contributor without `grain` installed gets a silent
no-op, never a failing hook. Hooks load at Claude Code session start, so a newly
added config takes effect in the next session.

## What happens

1. **AI edits a file** → the PostToolUse hook pipes the event to `grain hook
   claude`, which appends the lines AI just wrote to `.grain/ai-edits.jsonl` —
   as short **content hashes**, not text (nothing sensitive is stored; the
   ledger is gitignored and transient).
2. **You commit** → `grain attest` hashes the commit's added lines, matches them
   against the ledger, and writes a git note on `refs/notes/grain`:
   ```
   Provenance: assisted        # "ai" when every added line was AI-written
   AI-Lines: 360/464           # exactly n of the m substantive added lines
   AI-Hashes: 0320d2bd7a,…     # the AI lines, by content hash
   ```
   Matched lines are consumed from the ledger so nothing is attested twice.
3. **Push the notes** with `git push origin refs/notes/grain` so Grain Cloud and
   teammates see them.

Hashes are content-based, so an attestation is **shift-proof**: later edits
elsewhere in the file don't break it. A line the human rewrites afterwards gets
a new hash and stops matching — which is the right answer.

## `grain blame <file>`

`git blame` for AI. Every line shows its commit and whether it was AI-written,
resolved per line from the attested hashes (or per commit when a note or
declared trailer covers the whole commit):

```
AI 2a65cf1    3  import (
AI 2a65cf1    4  	"bufio"
   9f8e7d6   40  // human-written comment
cmd/grain/provenance.go — 505 lines · 360 AI-written (71%)
```

Blank and trivial lines (`}`, `)`) carry no signal and are never counted, on
either side.

## How it changes the numbers

Before, an attested or declared commit counted **all** of its lines as AI.
With `AI-Lines: n/m`, the report splits the commit by its true share — in the
summary, in the per-directory breakdown, and in the Cloud scan
(`ai_by_basis.attested` uses the fraction). A commit that was 3 AI lines plus 1
human line is 75% AI, not 100%.

## What it deliberately does not claim

Attestation only covers what a hook actually captured. Edits made before the
hook existed, in another editor, or by hand are not claimed as AI even if they
sit in an AI-co-authored commit — this repo's own commit `2a65cf1` attests
360/464 lines for exactly that reason. Signals, not verdicts.
