# Provenance

Authorship mix for **FrontTribe/grain**, measured from 120 commits. Signals, not verdicts.

| | Share |
|---|---|
| Human-authored | **4%** |
| AI-assisted | 96% |
| Unclassified | 0% |

## By directory

| Path | Human | AI | Lines | |
|---|---|---|---|---|
| `web/src/` | 5% | 95% | 12963 |  |
| `web/` | 0% | 100% | 7322 |  |
| `docs/` | 4% | 96% | 5635 |  |
| `design/product/` | 0% | 100% | 2852 |  |
| `cmd/grain/` | 10% | 90% | 1917 |  |
| `(root)` | 4% | 96% | 1772 |  |
| `design/cloud/` | 0% | 100% | 1328 |  |
| `design/brand/` | 0% | 100% | 1294 |  |

## Outcomes

What happened to the code after it landed — AI-written and human-written lines from the **same** line-attested commits, so author, style and era are held constant.

| | Lines | Later reworked | In a fix/revert | Median commits until rework |
|---|---|---|---|---|
| AI-written | 6046 | 686 (11%) | 9 | 5 |
| Human-written | 988 | 79 (8%) | 5 | 1 |

**AI-written lines were reworked 1.4× as often as human-written ones.**

## Risk

**449 of 449 AI-written lines in critical paths (100%) landed without review evidence.** Review evidence is anything git can see — a `Reviewed-by` trailer, a squash-merge `(#123)` subject, arriving via a merge, or a committer other than the author. Absence means no evidence, not proof of no review.

| Critical path | AI lines | Unreviewed | Commits |
|---|---|---|---|
| `workflows` | 155 | 155 | 7 |
| `auth` | 129 | 129 | 7 |
| `login` | 107 | 107 | 6 |
| `billing` | 58 | 58 | 2 |

**Hotspots** — commits that put the most unreviewed AI lines into a critical path:

- `7463443` web: grain favicon + auth & onboarding flow — `login`, 53 lines
- `d472442` feat: Stripe billing integration — `billing`, 50 lines
- `33617b9` Add npm shim so `npx grain` works, plus a release workflow — `workflows`, 39 lines
- `d732d4e` Auto-publish Homebrew formula from the release workflow — `workflows`, 35 lines
- `63ffec5` Add Scoop bucket (Windows): manifest + updater + auto-publish + docs — `workflows`, 34 lines
- `3817649` feat(web): sign-in, sign-up and reset pages aligned with the landing page — `login`, 33 lines
- `a064bcb` web: wire real Supabase auth + data — `auth`, 27 lines
- `66b8036` Add GitHub Action (PR provenance comment) + CI, and grain check --format md — `workflows`, 19 lines
- `6d8fd6b` feat(cloud): wire filters, search, custom dropdowns & sliders — `auth`, 19 lines
- `66b8036` Add GitHub Action (PR provenance comment) + CI, and grain check --format md — `workflows`, 18 lines

## Security

**2 lines look worth a second look; 2 were AI-written, 2 of those with no review evidence.** These are pattern matches joined with provenance, not confirmed vulnerabilities: a place to look, not a verdict.

| Pattern | Severity | AI-written | Human |
|---|---|---|---|
| `net.cors-any-origin` CORS open to any origin | medium | 1 | 0 |
| `tls.verification-disabled` TLS verification disabled | high | 1 | 0 |

**Findings** — worst first (AI-written, unreviewed, critical path):

- `fd715e3` `docs/launch.html` — TLS verification disabled (high, AI, unreviewed)  
  `<li><b>A screenshot of the hook talking back to Claude Code</b>: the agent writes <code>verify=False</code>, grain an…`
- `5f49f3c` `web/src/app/.well-known/grain-keys.json/route.ts` — CORS open to any origin (medium, AI, unreviewed)  
  `{ headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } },`

## Dependencies

**17 dependencies were added in this range; 14 by AI-written lines, 14 of those with no review evidence.** Checked against the registries: **0 not found** (a hallucinated name is the slopsquatting seed) and **0 younger than 30 days**.

| Package | Ecosystem | Added by | Reviewed | Registry |
|---|---|---|---|---|
| `next` | npm | AI (`c5a3237`) | no evidence | 5544 days old |
| `react` | npm | AI (`c5a3237`) | no evidence | 5437 days old |
| `react-dom` | npm | AI (`c5a3237`) | no evidence | 4514 days old |
| `@tailwindcss/postcss` | npm | AI (`c5a3237`) | no evidence | 955 days old |
| `@types/node` | npm | AI (`c5a3237`) | no evidence | 3772 days old |
| `@types/react` | npm | AI (`c5a3237`) | no evidence | 3772 days old |
| `@types/react-dom` | npm | AI (`c5a3237`) | no evidence | 3772 days old |
| `eslint` | npm | AI (`c5a3237`) | no evidence | 4820 days old |
| `eslint-config-next` | npm | AI (`c5a3237`) | no evidence | 4012 days old |
| `tailwindcss` | npm | AI (`c5a3237`) | no evidence | 3265 days old |
| `typescript` | npm | AI (`c5a3237`) | no evidence | 5096 days old |
| `@supabase/ssr` | npm | AI (`a064bcb`) | no evidence | 1104 days old |
| `@supabase/supabase-js` | npm | AI (`a064bcb`) | no evidence | 2433 days old |
| `stripe` | npm | AI (`d472442`) | no evidence | 5466 days old |
| `gsap` | npm | human (`b00c15e`) | no evidence | 4403 days old |
| `three` | npm | human (`b00c15e`) | no evidence | 5029 days old |
| `@types/three` | npm | human (`b00c15e`) | no evidence | 3772 days old |

> **How this is measured:** declared signals (`Co-Authored-By`, bot commits, explicit tags) dominate; behavioral inference is capped at 0.70 confidence and never stated as fact.

<sub>Generated by grain 0.1.0 · engine weights w2-content/f1 · 2026-09-15 · reproducible from grain.json</sub>
