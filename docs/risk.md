# Risk — AI-written code in critical paths without review

"38% AI" is a vanity number. What a lead needs to know is **where** AI-written
code landed and **whether anyone looked at it**. Risk answers that: AI-written
lines in security- and money-sensitive paths that carry no evidence of review,
down to the specific commits.

## Method

1. **Which lines are AI-written** comes from grain's provenance: line-level
   attestation (`grain attest`) for exact lines, otherwise attested/declared
   commits as a whole. Inference is never used here.
2. **Which paths are critical** — the built-in list below, matched
   case-insensitively against whole path segments and file stems (`auth` hits
   `src/auth/` and `auth.go`, not `author.go`), plus the repo's policy
   `human_owned` paths (prefix match, like `src/payments/**`). Override the
   built-ins with `critical = [...]` in `.grain.toml`.
3. **Review evidence** — anything git can see:
   - a `Reviewed-by:`, `Reviewed-on:` or `Approved-by:` trailer
   - a squash-merge subject ending in `(#123)` or a `Merge pull request …` subject
   - arriving through a merge (not on the branch's first-parent chain)
   - a committer other than the author (GitHub's merge button, a maintainer applying a patch)

   A commit with none of these is **unreviewed by evidence** — which is not
   proof nobody looked, only that git can't show they did.

Built-in critical fragments: `auth authn authz login session token secret(s)
crypto password payment(s) billing checkout iam permission(s) migration(s) infra
terraform k8s helm deploy workflows dockerfile`.

## Reading it

```
risk: 312 AI lines in critical paths, 312 (100%) without review evidence · auth 240, workflows 72
```

- The headline is the count and share of critical-path AI lines with no review
  evidence; per path you get AI lines, unreviewed lines and how many commits
  put them there.
- **Hotspots** are the commits that contributed the most unreviewed AI lines to
  a critical path — the place to start a review.
- `reviewed_commits` / `unreviewed_commits` in `grain.json` show how much of
  the repo's AI-bearing history had review evidence at all.

## Where it shows

`grain scan` prints the line; `PROVENANCE.md` gets a **Risk** section with the
table and hotspots; `grain.json` carries the `risk` block; `grain push` sends
it to Grain Cloud, where the repo page shows a **Risk** card.

Cloud GitHub scans compute their own block over the commits they deep-scan
(the card says "last N commits"), with one upgrade the CLI can't make: review
evidence comes from the **GitHub PR API** — whether a commit belongs to a pull
request, and whether someone other than the author approved it
(`approved_ai_lines`). GitHub is asked only about commits that put AI lines
into a critical path and carry no git-side evidence, so rate limits stay
comfortable. A push through the GitHub App that lands unreviewed AI lines in a
critical path **emails the workspace admins** with the hotspots; only the
pushed commits count, so one push means at most one alert.

## What it does not claim

Review evidence is a floor: teams that review over chat, in pairing sessions,
or with tooling that leaves no git trace will look unreviewed. The critical
list is a heuristic; tune `critical` for your codebase. And an unreviewed AI
line in `auth/` is a place to look, not a verdict on the code. Signals, not
verdicts.
