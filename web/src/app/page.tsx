import Link from "next/link";
import { Mark } from "@/components/Mark";
import { SELF_SCAN, SELF_COMMITS } from "@/lib/self-scan";
import { PLAN_FEATURES, TEAM_PRICE_USD } from "@/lib/plan";
import { BlameReveal } from "@/components/marketing/BlameReveal";
import { BLAME_FILE, BLAME_LINES, BLAME_SUMMARY } from "@/lib/self-blame";
import { TiltCard } from "@/components/marketing/TiltCard";
import { Fingerprint } from "@/components/Fingerprint";
import { StepsScrolly, type StepData } from "@/components/marketing/StepsScrolly";
import { CountUp } from "@/components/marketing/CountUp";
import { Terminal } from "@/components/marketing/Terminal";
import { InstallPicker, CopyCommand } from "@/components/marketing/InstallPicker";

const REPO = "https://github.com/FrontTribe/grain";
const SPEC = `${REPO}/blob/main/docs/spec/provenance-v1.md`;

// Every figure on this page is real output: grain run on its own repository
// (numbers in @/lib/self-scan), command transcripts copied from a terminal,
// the alert email as it was delivered. Nothing is mocked.


// Terminal sessions, run on this repository. Lines starting with "$ " are
// the commands; everything else is what grain printed.
const STEPS: StepData[] = [
  {
    cmd: "grain hook install",
    title: "Install the hook once",
    body: "A git post-commit hook plus a Claude Code hook. From then on, every line the agent writes is logged as a content hash, never as text.",
    out: [
      "$ grain hook install",
      "✓ installed .git/hooks/post-commit",
      "",
      "Add this to .claude/settings.json so AI edits are captured at the source:",
      "",
      "{",
      '  "hooks": {',
      '    "PostToolUse": [{',
      '      "matcher": "Edit|Write|MultiEdit",',
      '      "hooks": [{ "type": "command",',
      '        "command": "command -v grain >/dev/null 2>&1 && grain hook claude || true" }]',
      "    }]",
      "  }",
      "}",
      "",
      "From then on every commit is attested automatically. Try: grain blame <file>",
    ],
  },
  {
    cmd: "git commit",
    title: "Commit as usual",
    body: "The hook matches the commit's added lines against the ledger and writes a signed note: exactly which lines were AI-written, bound to that commit.",
    out: [
      '$ git commit -m "feat: signed provenance standard"',
      "grain attest  5f49f3c: Provenance: assisted, 889/961 added lines AI-written",
      "  note on refs/notes/grain, signed 336b33f8517eb53b",
      "  push it with: git push origin refs/notes/grain",
      "",
      "$ git notes --ref=grain show HEAD",
      "Provenance: assisted",
      "AI-Lines: 889/961",
      "AI-Hashes: 0320d2bd7a,1c9e0f77b2,3a8f1c02de,…",
      "Signed-By: ed25519:gsnAw0076ceAPFu8U35z7QjoQYD8ZTrNksSjzdPF6B4=",
      "Signature: ikJWlrLo5T6OlaBlxNr9brS5D5n1qBo5aLnd7aTJlP92Ieak…",
    ],
  },
  {
    cmd: "grain verify",
    title: "Check it, anywhere",
    body: "Any clone can verify every attestation offline. A note that was edited or moved to another commit fails. Teams list trusted keys in .grain/signers.",
    out: [
      "$ git clone https://github.com/FrontTribe/grain && cd grain",
      "$ git fetch origin refs/notes/grain:refs/notes/grain",
      "$ grain verify",
      "grain verify: 91 commits, 14 attested",
      "  signed, valid     5",
      "  signed, invalid   0",
      "  unsigned          9",
      "  ✓ every attestation checks out",
    ],
  },
];

const RISK_MAX = Math.max(...SELF_SCAN.risk.paths.map((p) => p.lines), 1);
const pctOf = (n: number, d: number) => `${d > 0 ? Math.round((n / d) * 1000) / 10 : 0}%`;
const ratio = (o: { ai_reworked: number; ai_lines: number; human_reworked: number; human_lines: number }) => {
  const a = o.ai_lines > 0 ? o.ai_reworked / o.ai_lines : 0;
  const h = o.human_lines > 0 ? o.human_reworked / o.human_lines : 0;
  return h > 0 ? (a / h).toFixed(2) : "n/a";
};

const btn = "press inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[10px] px-5 text-[14px] font-semibold";
const btnPrimary = `${btn} bg-ink text-ground`;
const btnSecondary = `${btn} border border-line-strong text-ink hover:border-ink`;
const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";

export default function Home() {
  const s = SELF_SCAN;
  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-ink focus:px-4 focus:py-2 focus:text-ground">
        Skip to content
      </a>

      <nav className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
        <div className={`${container} flex h-16 items-center gap-7`}>
          <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
            <Mark size={22} /> grain
          </Link>
          <div className="hidden items-center gap-6 text-[14px] text-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#try" className="hover:text-ink">Try it</a>
            <a href="#cloud" className="hover:text-ink">Cloud</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href={`${REPO}#readme`} className="hover:text-ink">Docs</a>
            <a href={REPO} className="hover:text-ink">GitHub</a>
          </div>
          <span className="flex-1" />
          <Link href="/login" className="hidden text-[14px] text-muted hover:text-ink sm:block">Sign in</Link>
          <Link href="/signup" className={`${btn} h-9 bg-ink px-4 text-ground`}>Start free</Link>
        </div>
      </nav>

      <main id="main">
        {/* Hero: asymmetric split. Text carries the claim; the proof is real
            `grain blame` output from this repository. */}
        <header>
          <div className={`${container} grid items-center gap-10 pb-16 pt-14 lg:grid-cols-[minmax(0,13fr)_minmax(0,11fr)] lg:gap-14 lg:pb-24 lg:pt-20`}>
          <div>
            <h1 className="rise text-balance font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-[54px] lg:text-[58px]" style={{ "--i": 0 } as React.CSSProperties}>
              Know which lines the <span className="ai-word text-ai">AI</span> wrote.
            </h1>
            <p className="rise mt-5 max-w-[42ch] text-[18px] leading-relaxed text-muted sm:text-[19px]" style={{ "--i": 1 } as React.CSSProperties}>
              Grain records AI edits as they happen, signs them into git, and shows where they landed without review.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ "--i": 2 } as React.CSSProperties}>
              <Link href="/signup" className={btnPrimary}>Start free</Link>
              <a href={`${REPO}#readme`} className={btnSecondary}>Read the docs</a>
            </div>
          </div>

          <figure className="rise min-w-0" style={{ "--i": 3 } as React.CSSProperties}>
            <TiltCard className="hero-card rounded-[14px]">
              <BlameReveal
                file={BLAME_FILE}
                lines={BLAME_LINES}
                summary={<>{BLAME_SUMMARY.lines} lines, <span className="text-ai">{BLAME_SUMMARY.ai} AI-written</span> ({BLAME_SUMMARY.pct}%), attested from git notes</>}
              />
            </TiltCard>
            <figcaption className="mt-2.5 text-[12.5px] text-faint">
              Real output. Lines the hook captured are tagged; lines from before the hook existed are shown as human, not guessed.
            </figcaption>
          </figure>
          </div>
        </header>

        {/* Proof band: grain's own history as a barcode of real commits. */}
        <section aria-labelledby="self-h" className="border-y border-line bg-surface">
          <div className={`${container} py-10 lg:py-12`}>
            <h2 id="self-h" className="text-balance font-display text-[24px] font-bold tracking-tight sm:text-[28px]">
              Measured on grain itself: {s.commits} commits, oldest to newest.
            </h2>
            <div className="reveal mt-6">
              <Fingerprint height={88} data={SELF_COMMITS} />
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <Stat label="AI-assisted" value={`${s.ai}%`} tone="ai" />
              <Stat label="Human-written" value={`${s.human}%`} tone="human" />
              <Stat label="Attested line by line" value={`${s.attested}%`} />
              <Stat label="In critical paths, unreviewed" value={String(s.risk.unreviewed)} tone="ai" note="lines" />
            </dl>
            <p className="mt-5 max-w-[68ch] text-[13.5px] text-muted">
              Grain is written almost entirely with Claude Code. Every claim on this page is what the tool says about its own repository, as of {s.generated}.
            </p>
          </div>
        </section>

        {/* How it works: three stacked steps, command on the left, what
            happens on the right, with the real transcript of each. */}
        <section id="how" aria-labelledby="how-h" className={`${container} py-20 lg:py-24`}>
          <h2 id="how-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
            Recorded when the AI writes it, not guessed afterwards.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
            Detecting AI code after the fact is unreliable. Grain hooks into the agent instead, so provenance is captured at the source and travels with the commit.
          </p>

          <StepsScrolly steps={STEPS} />
        </section>

        {/* Try it: no sign-up, one command, the real output. */}
        <section id="try" aria-labelledby="try-h" className="border-t border-line bg-surface">
          <div className={`${container} py-20 lg:py-24`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
              <div>
                <h2 id="try-h" className="text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
                  Run it on your repository first.
                </h2>
                <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
                  No account, nothing uploaded. The CLI reads your git history and writes <code className="font-mono text-[14px]">PROVENANCE.md</code> and <code className="font-mono text-[14px]">grain.json</code> next to your code.
                </p>
                <div className="mt-7">
                  <InstallPicker />
                </div>
                <p className="mt-4 text-[13px] text-muted">Single static binary, MIT, no dependencies. Windows via Scoop, or a binary from Releases.</p>
              </div>
              <Terminal
                animate={false}
                className="self-start"
                lines={[
                  "$ grain scan",
                  "grain 0.1.0 · scanning FrontTribe/grain",
                  "  reading 91 commits done",
                  "  provenance:",
                  "    human-authored    2%  ░░░░░░░░░░░░░░░░░░░░",
                  "    ai-assisted      98%  ████████████████████",
                  "    unclassified      0%  ░░░░░░░░░░░░░░░░░░░░",
                  "  outcomes (strict · 3595 AI lines, 303 human): AI reworked 8% vs human 17% · 0.48× as often",
                  "  risk: 416 AI lines in critical paths, 416 (100%) without review evidence · workflows 155, auth 129, login 74",
                  "  wrote PROVENANCE.md · grain.json",
                ]}
              />
            </div>
          </div>
        </section>

        {/* What it tells you: a four-cell bento with real numbers. Risk gets
            the width because it is the number a lead acts on. */}
        <section aria-labelledby="tells-h" className="border-t border-line">
          <div className={`${container} py-20 lg:py-24`}>
            <h2 id="tells-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
              Not a percentage. Where it landed, and whether anyone looked.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
              Four views of the same repository, all from one scan. Every number below is grain reading its own history on {s.generated}.
            </p>

            <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              {/* Risk: the number a lead acts on, then where, then which commits. */}
              <article className="reveal rounded-[14px] bg-ai-soft p-6 sm:p-8">
                <h3 className="font-display text-[20px] font-bold tracking-tight">Risk</h3>
                <p className="mt-1.5 max-w-[50ch] text-[14.5px] text-muted">
                  AI-written lines in security- and money-sensitive paths with no review evidence: no approved pull request, no reviewer trailer, not merged, committed by the author.
                </p>
                <p className="mt-6 font-display text-[44px] font-extrabold leading-none tracking-tight text-ai sm:text-[56px]">
                  <CountUp value={s.risk.unreviewed} className="tabular-nums" />
                  <span className="ml-2 text-[16px] font-semibold text-muted">of {s.risk.lines} critical AI lines unreviewed</span>
                </p>

                <ul className="mt-7 flex flex-col gap-2.5 font-mono text-[13px]">
                  {s.risk.paths.map((p) => (
                    <li key={p.path} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
                      <span className="text-muted">{p.path}/</span>
                      <span className="h-1.5 rounded-full bg-ai" style={{ width: `${Math.max(4, (p.lines / RISK_MAX) * 100)}%` }} aria-hidden />
                      <span className="text-right font-semibold tabular-nums text-ink">{p.lines}</span>
                    </li>
                  ))}
                </ul>

                <h4 className="mt-8 text-[13px] font-semibold text-ink">Start here</h4>
                <ol className="mt-2 divide-y divide-ai/15">
                  {s.risk.hotspots.map((h) => (
                    <li key={h.sha + h.path} className="grid gap-x-4 gap-y-0.5 py-2.5 text-[13px] sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-baseline">
                      <code className="font-mono text-[12px] text-muted">{h.sha}</code>
                      <span className="truncate text-ink">{h.subject}</span>
                      <span className="font-mono text-[12px] text-muted">
                        {h.path}/ <b className="font-semibold text-ai">{h.lines}</b>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 text-[12.5px] text-muted">A place to look, not a verdict. Absence of evidence is not proof nobody reviewed.</p>
              </article>

              <div className="grid gap-4">
                {/* Outcomes: the question every team is asking, answered on the same commits. */}
                <article className="reveal rounded-[14px] bg-human-soft p-6 sm:p-7">
                  <h3 className="font-display text-[20px] font-bold tracking-tight">Outcomes</h3>
                  <p className="mt-1.5 text-[14.5px] text-muted">
                    Does AI code get rewritten more? AI and human lines from the <em>same</em> line-attested commits, so author, style and era are held constant.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4 font-mono text-[13px]">
                    <div>
                      <div className="text-muted">AI lines</div>
                      <div className="text-[22px] font-semibold text-ai">{s.outcomes.ai_lines.toLocaleString()}</div>
                      <div className="text-muted">{pctOf(s.outcomes.ai_reworked, s.outcomes.ai_lines)} later reworked</div>
                      <div className="text-muted">{s.outcomes.ai_in_fix} in a fix or revert</div>
                    </div>
                    <div>
                      <div className="text-muted">human lines</div>
                      <div className="text-[22px] font-semibold text-human">{s.outcomes.human_lines.toLocaleString()}</div>
                      <div className="text-muted">{pctOf(s.outcomes.human_reworked, s.outcomes.human_lines)} later reworked</div>
                      <div className="text-muted">{s.outcomes.human_in_fix} in a fix or revert</div>
                    </div>
                  </div>
                  <p className="mt-4 text-[13px] text-ink">
                    Here, AI lines are reworked <b className="font-semibold">{ratio(s.outcomes)}× as often</b> as human lines, after a median of {s.outcomes.ai_median} commits.
                  </p>
                  <p className="mt-2 text-[12.5px] text-muted">One repository, a few months of history. Measure your own before drawing conclusions.</p>
                </article>

                {/* Provenance: three tiers, in the order grain trusts them. */}
                <article className="reveal rounded-[14px] border border-line bg-surface p-6 sm:p-7">
                  <h3 className="font-display text-[20px] font-bold tracking-tight">Provenance, by how it was known</h3>
                  <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-md" aria-hidden>
                    <span className="bg-human" style={{ width: `${s.attested}%` }} />
                    <span className="bg-ai" style={{ width: `${s.declared}%` }} />
                    <span className="bg-line-strong" style={{ width: `${Math.max(s.inferred, 1)}%` }} />
                  </div>
                  <dl className="mt-4 grid gap-3 text-[13px]">
                    <Tier swatch="bg-human" name="attested" value={`${s.attested}%`}>Signed git note, line by line. Ground truth.</Tier>
                    <Tier swatch="bg-ai" name="declared" value={`${s.declared}%`}>A Co-Authored-By trailer, a bot account, an explicit tag.</Tier>
                    <Tier swatch="bg-line-strong" name="inferred" value={`${s.inferred}%`}>Content and behaviour signals. Capped at 0.70, always labelled.</Tier>
                  </dl>
                </article>
              </div>

              {/* By directory: where the AI code physically is. */}
              <article className="reveal rounded-[14px] border border-line bg-surface p-6 sm:p-7 lg:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="font-display text-[20px] font-bold tracking-tight">By directory</h3>
                  <span className="text-[12.5px] text-muted">lines changed, and how many of them carry AI signals</span>
                </div>
                <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
                  {s.by_path.map((p) => (
                    <li key={p.path} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 font-mono text-[13px]">
                      <span className="truncate text-ink">{p.path}</span>
                      <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                        <span className="bg-ai" style={{ width: `${p.ai}%` }} />
                        <span className="bg-human" style={{ width: `${100 - p.ai}%` }} />
                      </span>
                      <span className="text-right text-muted">
                        <b className="font-semibold text-ink">{p.ai}%</b> AI
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] text-muted">
                  Mark a path <code className="font-mono">human_owned</code> in policy and grain flags AI lines landing there on every scan.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* In the pull request: the Action, and the comment it leaves. */}
        <section id="pr" aria-labelledby="pr-h" className={`${container} py-20 lg:py-24`}>
          <h2 id="pr-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
            A calm comment on every pull request.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
            Add the GitHub Action and each PR gets an itemised note from grain: how much of the change carries AI signals, whether it touches paths you marked human-owned, and what your policy asks for. Framed as signals, never as an accusation.
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
            <figure>
              <div className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
                <div className="flex items-center gap-2.5 text-[13px]">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink font-display text-[11px] font-extrabold text-ground">g</span>
                  <b className="font-semibold text-ink">grain</b>
                  <span className="rounded-[5px] border border-line px-1.5 py-px font-mono text-[10.5px] text-muted">bot</span>
                  <span className="text-muted">commented</span>
                </div>
                <pre className="mt-4 overflow-x-auto font-mono text-[12.5px] leading-[1.8] text-ink">
{`grain report · #482
› 62% of +214 lines carry AI-authorship signals  (1 Co-Authored-By: Claude)
› 2 files touch src/auth/, human-owned per CODEOWNERS
› convention check: 3 deviations from repo style
policy: AI share > 40% in a human-owned path, 1 human review requested`}
                </pre>
              </div>
              <figcaption className="mt-2.5 text-[12.5px] text-faint">Example comment. The Action also sets a check, so a policy can block the merge until a human has reviewed.</figcaption>
            </figure>
            <div>
              <div className="text-[13px] font-semibold text-ink">.github/workflows/grain.yml</div>
              <pre className="mt-2 overflow-x-auto rounded-[14px] border border-line bg-surface-2 px-4 py-3.5 font-mono text-[12px] leading-[1.7] text-ink">
{`name: Grain
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  provenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: FrontTribe/grain@v1`}
              </pre>
              <p className="mt-3 text-[13.5px] text-muted">Twelve lines. No token beyond the one Actions already has.</p>
            </div>
          </div>
        </section>

        {/* Cloud: stacked heading, then the real alert next to what the
            GitHub App does. */}
        <section id="cloud" aria-labelledby="cloud-h" className="border-t border-line bg-surface">
          <div className={`${container} py-20 lg:py-24`}>
            <h2 id="cloud-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
              Cloud watches every push and tells you when it matters.
            </h2>
            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
              <figure className="reveal">
                <div className="rounded-[14px] border border-line bg-ground p-5 sm:p-6">
                  <div className="font-mono text-[12px] text-muted">
                    <div>from: grain &lt;notifications@getgrain.dev&gt;</div>
                    <div className="mt-1 text-ink">subject: kresogalic8: 24 unreviewed AI-written lines landed in auth</div>
                  </div>
                  <p className="mt-5 text-[14.5px] leading-relaxed">
                    A push to <b>kresogalic8</b> put <b>24 AI-written lines</b> into <code className="font-mono text-[13px]">auth</code> with no review evidence: no pull request, no reviewer trailer, applied by the author.
                  </p>
                  <p className="mt-3 font-mono text-[12.5px] text-muted">f29359c feat: session handling · auth, 24 lines</p>
                </div>
                <figcaption className="mt-2.5 text-[12.5px] text-faint">Delivered 23:07, four seconds after the push.</figcaption>
              </figure>
              <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                <Feature title="Scans on every push">Install the GitHub App. Each push to the default branch re-scans the repo and updates the dashboard.</Feature>
                <Feature title="Review evidence from GitHub">Cloud asks the pull request API whether a commit went through a PR and who approved it.</Feature>
                <Feature title="Alerts that name the commit">Threshold crossings and unreviewed AI code in critical paths email your workspace admins with the hotspots.</Feature>
                <Feature title="Security signals with provenance">Dangerous-looking lines (secrets, TLS off, shell and SQL from strings) shown with who wrote them and whether anyone reviewed them. The same check runs inside the agent loop, before the commit.</Feature>
                <Feature title="A signed authorship report">Export a Bill of Materials signed by grain Cloud, for audits and due diligence. Anyone can verify it.</Feature>
              </ul>
            </div>
            <div className="mt-10">
              <Link href="/signup" className={btnPrimary}>Start free</Link>
            </div>
          </div>
        </section>

        {/* Who it's for: three jobs, three concrete outcomes. Plain columns. */}
        <section aria-labelledby="who-h" className={`${container} py-20 lg:py-24`}>
          <h2 id="who-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
            Built for the three people who get asked about AI code.
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
            <Role title="Engineering leads" href="#cloud" link="See Cloud alerts">
              You approved the agents. Now you want to know where their code lands unreviewed, and to hear about it before an incident does.
            </Role>
            <Role title="Open-source maintainers" href="#pr" link="See the PR check">
              Your contribution policy asks for AI disclosure. grain turns the honour system into a number on every pull request, with a badge for the README.
            </Role>
            <Role title="Compliance and due diligence" href="/verify" link="Verify a report">
              An auditor, an acquirer, or the EU AI Act asks what was machine-written. Hand them a signed Bill of Materials they can check themselves.
            </Role>
          </div>
        </section>

        {/* Open standard: prose, then the links that let anyone check the work. */}
        <section aria-labelledby="open-h" className="border-t border-line">
          <div className={`${container} py-20 lg:py-24`}>
            <div className="max-w-[64ch]">
              <h2 id="open-h" className="text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
                Open format, open engine, nothing to take on trust.
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
                Attestations are plain text in git notes. Signatures are Ed25519, bound to the commit. Reports carry a digest and a signature you can check in the browser or offline. The engine is MIT-licensed Go with no dependencies, so the numbers can be reproduced by anyone with a clone.
              </p>
            </div>
            <ul className="mt-8 max-w-[760px] divide-y divide-line border-y border-line">
              <LinkRow href={SPEC} title="grain provenance v1">The note format, line hashes, signature scheme, and BOM schema.</LinkRow>
              <LinkRow href="/verify" title="Verify a report">Paste an authorship report; the digest and signature are checked client-side.</LinkRow>
              <LinkRow href={REPO} title="Read the source">CLI, engine, and Cloud in one repository. Star it, fork it, audit it.</LinkRow>
            </ul>
          </div>
        </section>

        {/* Objections, answered plainly. Two columns, no accordion. */}
        <section aria-labelledby="faq-h" className={`${container} py-20 lg:py-24`}>
          <h2 id="faq-h" className="max-w-[24ch] text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
            The questions people ask before they run it.
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            <QA q="Does my code leave my machine?">
              Not with the CLI: it reads your git history locally and writes two files into the repo. The edit ledger stores content hashes, never text. Cloud reads repositories through the GitHub App you install, with read-only access you can revoke.
            </QA>
            <QA q="Can it be wrong?">
              Inference can, which is why it is capped at 0.70 confidence and always labelled. Attested and declared provenance are records, not guesses. Every report separates the three so you can see what rests on what.
            </QA>
            <QA q="What about code written before the hook existed?">
              It is scored from what git already knows: Co-Authored-By trailers, bot accounts, tags, then capped inference. Lines nobody attested are shown as human, never claimed as AI.
            </QA>
            <QA q="Will it slow down commits?">
              The post-commit hook hashes the lines the commit added and writes one note. On this repository that is a few milliseconds. Nothing runs in the editor loop.
            </QA>
            <QA q="Does it catch security problems?">
              It catches the lines that make vibe coding dangerous: a pasted token, TLS verification turned off, a shell or SQL command built from input, unsafe deserialization, wildcard IAM. When Claude Code writes one, grain tells the agent before the commit; every report says which of these lines an AI wrote and whether anyone reviewed them. It also lists the dependencies AI-written lines added and asks the registry whether each package exists and how old it is, the slopsquatting check. It is not a vulnerability scanner, and it says so next to every finding.
            </QA>
            <QA q="Which agents does it capture?">
              Claude Code today, through its PostToolUse hook. The ledger format is a JSON line per edit, so any tool that can run a command after writing a file can attest.
            </QA>
            <QA q="Is it really open source?">
              The engine, CLI, GitHub Action and the provenance format are MIT, in one repository. Cloud is the hosted dashboard, alerts and signed reports on top of the same engine.
            </QA>
          </dl>
        </section>

        {/* Pricing: two columns, the recommended one by colour, not height. */}
        <section id="pricing" aria-labelledby="pricing-h" className="border-t border-line bg-surface">
          <div className={`${container} py-20 lg:py-24`}>
            <h2 id="pricing-h" className="text-balance font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
              The CLI is free forever. Cloud is free to start.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
              Free shows you everything. Team is for when you want to be told, and to hand the numbers to someone else.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col rounded-[14px] border border-line bg-ground p-7">
                <h3 className="font-display text-[22px] font-bold tracking-tight">Free</h3>
                <p className="mt-1 text-[14.5px] text-muted">For solo developers and small projects.</p>
                <p className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-tight">$0</p>
                <ul className="mt-6 flex flex-col gap-2.5 text-[14.5px]">
                  {PLAN_FEATURES.free.map((f) => <Li key={f}>{f}</Li>)}
                </ul>
                <div className="mt-auto pt-8">
                  <Link href="/signup" className={`${btnSecondary} w-full`}>Start free</Link>
                  <p className="mt-2.5 text-center text-[12.5px] text-muted">No card required.</p>
                </div>
              </div>
              <div className="flex flex-col rounded-[14px] border border-human bg-ground p-7">
                <h3 className="font-display text-[22px] font-bold tracking-tight text-human">Team</h3>
                <p className="mt-1 text-[14.5px] text-muted">For teams shipping with agents every day.</p>
                <p className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-tight">
                  ${TEAM_PRICE_USD}<span className="text-[16px] font-semibold text-muted"> per workspace, per month</span>
                </p>
                <ul className="mt-6 flex flex-col gap-2.5 text-[14.5px]">
                  {PLAN_FEATURES.team.map((f) => <Li key={f}>{f}</Li>)}
                </ul>
                <div className="mt-auto pt-8">
                  <Link href="/signup" className={`${btnPrimary} w-full`}>Start free</Link>
                  <p className="mt-2.5 text-center text-[12.5px] text-muted">Upgrade or cancel in Settings, any time.</p>
                </div>
              </div>
              <div className="flex flex-col rounded-[14px] border border-line bg-ground p-7">
                <h3 className="font-display text-[22px] font-bold tracking-tight">Audit</h3>
                <p className="mt-1 text-[14.5px] text-muted">For regulated teams, due diligence, and procurement.</p>
                <p className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-tight">
                  $199<span className="text-[16px] font-semibold text-muted"> per month, from</span>
                </p>
                <ul className="mt-6 flex flex-col gap-2.5 text-[14.5px]">
                  {PLAN_FEATURES.audit.map((f) => <Li key={f}>{f}</Li>)}
                </ul>
                <div className="mt-auto pt-8">
                  <a href="mailto:kresimir.galic@fronttribe.com?subject=grain%20Audit%20plan" className={`${btnSecondary} w-full`}>Talk to us</a>
                  <p className="mt-2.5 text-center text-[12.5px] text-muted">Tell us what your audit needs.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${container} py-20 text-center lg:py-24`}>
          <h2 className="mx-auto max-w-[20ch] text-balance font-display text-[32px] font-bold tracking-tight sm:text-[40px]">
            See the grain of your own codebase.
          </h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[16.5px] text-muted">Connect a repository and let Cloud keep watching, or run one command locally right now.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={btnPrimary}>Start free</Link>
            <a href={`${REPO}#readme`} className={btnSecondary}>Read the docs</a>
          </div>
          <div className="mx-auto mt-6 max-w-[360px]">
            <CopyCommand cmd="npx grain scan" />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${container} flex flex-wrap items-center gap-x-6 gap-y-3 py-8 text-[13px] text-muted`}>
          <span className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink">
            <Mark size={18} /> grain
          </span>
          <a href={REPO} className="hover:text-ink">GitHub</a>
          <a href={SPEC} className="hover:text-ink">Provenance spec</a>
          <Link href="/verify" className="hover:text-ink">Verify a report</Link>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <span className="ml-auto">MIT licensed. Signals, not verdicts.</span>
        </div>
      </footer>
    </>
  );
}

function Stat({ label, value, tone, note }: { label: string; value: string; tone?: "ai" | "human"; note?: string }) {
  const color = tone === "ai" ? "text-ai" : tone === "human" ? "text-human" : "text-ink";
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-1 font-display text-[30px] font-extrabold leading-none tracking-tight ${color}`}>
        {value}
        {note && <span className="ml-1.5 text-[13px] font-medium text-muted">{note}</span>}
      </dd>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="reveal">
      <h3 className="font-display text-[17px] font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function LinkRow({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  const cls = "group grid gap-1 py-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6";
  const inner = (
    <>
      <span className="font-display text-[17px] font-bold tracking-tight underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">{title}</span>
      <span className="text-[14.5px] leading-relaxed text-muted">{children}</span>
    </>
  );
  return <li>{external ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>}</li>;
}

function Role({ title, href, link, children }: { title: string; href: string; link: string; children: React.ReactNode }) {
  const inner = <>{link} <span aria-hidden>→</span></>;
  const cls = "mt-3 inline-block text-[13.5px] font-semibold text-human underline decoration-human/40 underline-offset-4 hover:decoration-human";
  return (
    <div className="border-t border-line pt-5">
      <h3 className="font-display text-[19px] font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{children}</p>
      {href.startsWith("#") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>}
    </div>
  );
}

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-display text-[17px] font-bold tracking-tight">{q}</dt>
      <dd className="mt-1.5 max-w-[52ch] text-[14.5px] leading-relaxed text-muted">{children}</dd>
    </div>
  );
}

function Tier({ swatch, name, value, children }: { swatch: string; name: string; value: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_7.5rem_minmax(0,1fr)] items-baseline gap-x-3">
      <span className={`inline-block size-2 rounded-[2px] ${swatch}`} aria-hidden />
      <dt className="font-mono text-muted">
        {name} <b className="font-semibold text-ink">{value}</b>
      </dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="ml-4 list-disc marker:text-faint">{children}</li>;
}
