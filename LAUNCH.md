# Grain — Show HN launch plan

One shot at the front page. Copy-paste assets below; the full playbook (timing,
objection FAQ, cross-post schedule, metrics) is in `docs/launch.html`.

## Title (post the URL as the GitHub repo)

```
Show HN: Grain – records which lines your AI agent wrote and signs it into Git
```

Backups:
- `Show HN: Grain – know which lines the AI wrote, where they landed, and whether anyone reviewed them`
- `Show HN: I built "git blame for AI": signed, line-level provenance in your repo`

Title rules: no "revolutionary" / "AI-powered", no emoji, no hype. Say what it does.

## First comment (post immediately, from your own account)

> Hi HN. I built Grain because two things collided this year: AI agents now
> commit directly to repos, and maintainers have started rewriting their
> contribution policies to ask "what did an AI write here?" Detecting that
> after the fact is unreliable, so Grain records it at the source instead.
>
> A hook in the agent (Claude Code today) logs the lines it writes as content
> hashes. On commit, a post-commit hook matches them against the diff and writes
> a git note: exactly which lines were AI-written, signed with your Ed25519 key
> and bound to that commit. `grain blame <file>` then shows it per line, and
> `grain verify` checks every note in a clone, offline. The note format is a
> public spec; the engine is stdlib-only Go, MIT.
>
>     grain hook install
>     grain scan
>
> On top of that it reports two things a "38% AI" number can't: where AI-written
> lines landed in critical paths (auth, billing, workflows…) with no review
> evidence, down to the commits, and how often AI lines get reworked later
> versus human lines from the same commits.
>
> The core principle is "signals, not verdicts," and it is NOT an AI-cheating
> detector:
>
> - Attested beats declared (Co-Authored-By, bot accounts) beats inferred.
>   Inference is capped at 0.70 confidence and always labeled; it never claims
>   certainty from a guess. I published the calibration study, including the
>   part where the global model didn't generalize and why it's per-repo now.
> - It can be defeated by not installing the hook or stripping a trailer. That's
>   fine: it's a transparency tool for cooperative repos, not an anti-cheat, and
>   the README says so.
> - Your code never leaves your machine. The CLI reads git history locally; the
>   ledger stores hashes, not text.
>
> Honest dogfood: Grain reports its own repo as 97% AI-assisted, and since the
> hook landed the exact lines are attested and signed. It also reports 449
> AI-written lines in its own auth/billing/workflows paths with no review
> evidence, because I'm a solo dev and nobody reviewed them. It doesn't pretend
> otherwise.
>
> There's a hosted dashboard (getgrain.dev, free for 3 repos) that scans on push
> through a GitHub App, checks the PR API for review evidence, and emails you
> when unreviewed AI code lands in a critical path. The engine is the same.
>
> Two things I'd genuinely love feedback on: (1) which other agents should get a
> capture hook first (the ledger format is one JSON line per edit), and (2) as a
> maintainer, what would make the PR comment useful instead of noise?
>
> Repo: github.com/FrontTribe/grain — happy to answer anything.

## Pre-launch checklist (do it the day before)

- [ ] Repo is **public** (every launch link dies if it's private)
- [ ] README opens with what-it-is, the install commands and today's real output
      (`grain scan`, `grain explain`, `grain verify` on this repo)
- [ ] The install commands actually work on a clean machine (curl, brew, npx)
- [ ] Grain badge on grain's own README shows the current number (97%)
- [ ] `grain verify` passes on the repo and notes are pushed (`git push origin refs/notes/grain`)
- [ ] 20–30s demo GIF of `grain scan` + `grain blame` in the README
- [ ] getgrain.dev is up: landing, sign-up, `/verify`, `/.well-known/grain-keys.json`
- [ ] Stripe is live (not sandbox) if you want Team sign-ups on day one; see `docs/go-live-stripe.md`
- [ ] Resend domain verified so alert emails deliver
- [ ] LICENSE, CONTRIBUTING, green CI badge present
- [ ] No broken links, no lorem, no visible TODOs
- [ ] Objection-FAQ answers drafted (see `docs/launch.html`) so you reply fast:
      "isn't this surveillance?", "can't I just strip the trailer?", "why trust
      the classifier?", "what about Cursor / Copilot?"

## Timing

Tue–Thu, ~08:00–10:00 US Eastern. Be free to reply for 6 hours after. Never ask
for upvotes or organize voting — HN buries voting rings.

## The one number to watch

**Attested notes in the wild**: `refs/notes/grain` on someone else's repository
means the norm is forming, and a badge means they're proud of it. That's the
whole thesis; stars are vanity.
