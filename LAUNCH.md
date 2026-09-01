# Grain — Show HN launch plan

One shot at the front page. Copy-paste assets below; the full playbook (timing,
objection FAQ, cross-post schedule, metrics) is in `docs/launch.html`.

## Title (post the URL as the GitHub repo)

```
Show HN: Grain – see how much of your codebase was written by AI vs humans
```

Backups:
- `Show HN: Grain – a provenance layer that labels AI-assisted code in your repo`
- `Show HN: I built a "nutrition label" for AI vs human code in Git`

Title rules: no "revolutionary" / "AI-powered", no emoji, no hype. Say what it does.

## First comment (post immediately, from your own account)

> Hi HN. I built Grain because two things collided this year: AI agents now
> commit directly to repos, and maintainers have started rewriting their
> contribution policies to ask "what did an AI write here?" There was no neutral
> way to actually measure that, so I made one.
>
> Grain reads your git history and reports how much of a repo is human-written
> vs AI-assisted, with a confidence level on every claim. One command:
>
>     npx grain scan
>
> It writes a PROVENANCE.md, a grain.json, and a README badge. A GitHub Action
> posts a calm, itemized comment on each PR.
>
> The core principle is "signals, not verdicts," and it is NOT an AI-cheating
> detector — I've worked hard to keep it from becoming one:
>
> - Declared signals (Co-Authored-By trailers, bot accounts, explicit tags) are
>   high-confidence. Behavioral inference (diff shape, burst timing) is
>   deliberately weak and capped at 0.70 confidence — it never claims certainty
>   from a guess.
> - It can be defeated by stripping a trailer. That's fine: it's a transparency
>   tool for cooperative repos, not an anti-cheat. I say so in the README,
>   because overclaiming is exactly what would make a tool like this harmful.
> - The whole engine is dependency-free Go and runs locally — your code never
>   leaves your machine. MIT licensed.
>
> Honest dogfood: Grain scans its own repo as 100% AI-assisted, because every
> commit is Co-Authored-By Claude. It doesn't pretend otherwise.
>
> Two things I'd genuinely love feedback on: (1) does the behavioral-inference
> layer earn its place, or should it be declared-signals-only? (2) as a
> maintainer, what would make the PR comment useful instead of noise?
>
> Repo: github.com/kresimirgalic/grain — happy to answer anything.

## Pre-launch checklist (do it the day before)

- [ ] Repo is **public** (every launch link dies if it's private)
- [ ] README opens with what-it-is + `npx grain scan` + example output
- [ ] The install command actually works on a clean machine
- [ ] Grain badge on grain's own README (the honest 100%-AI dogfood)
- [ ] 20–30s demo GIF of `grain scan` in the README
- [ ] Landing site (`site/`) deployed; waitlist/contact links real or removed
- [ ] LICENSE, CONTRIBUTING, green CI badge present
- [ ] No broken links, no lorem, no visible TODOs
- [ ] Objection-FAQ answers drafted (see `docs/launch.html`) so you reply fast

## Timing

Tue–Thu, ~08:00–10:00 US Eastern. Be free to reply for 6 hours after. Never ask
for upvotes or organize voting — HN buries voting rings.

## The one number to watch

**Badges in the wild** — a grain badge on someone else's repo means the norm is
forming. That's the whole thesis; stars are vanity.
