import { Mark } from "@/components/Mark";
import { Fingerprint } from "@/components/Fingerprint";

const REPO = "https://github.com/FrontTribe/grain";

function ProvBar({ human, ai, unc = 0 }: { human: number; ai: number; unc?: number }) {
  return (
    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-md">
      <span className="h-full rounded-sm bg-human" style={{ width: `${human}%` }} />
      <span className="h-full rounded-sm bg-ai" style={{ width: `${ai}%` }} />
      {unc > 0 && <span className="h-full rounded-sm bg-line-strong" style={{ width: `${unc}%` }} />}
    </div>
  );
}

function Shield({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex overflow-hidden rounded border border-line-strong font-mono text-xs">
      <span className="bg-ink px-2 py-1 text-ground">{label}</span>
      <span className="bg-surface-2 px-2 py-1 font-semibold text-ink">{value}</span>
    </span>
  );
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-9 max-w-[62ch]">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-ai">{eyebrow}</div>
      <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-3.5 text-lg text-muted">{children}</p>}
    </div>
  );
}

const btnBase = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 font-mono text-sm font-medium transition";

export default function Home() {
  return (
    <main>
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-line bg-ground/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-6">
          <span className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
            <Mark size={24} /> grain
          </span>
          <div className="ml-3 hidden gap-6 text-[14.5px] text-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#detection" className="hover:text-ink">Detection</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href={REPO} className="hover:text-ink">Open source</a>
          </div>
          <span className="flex-1" />
          <a href={REPO} className={`${btnBase} border border-line-strong text-ink hover:border-brand hover:text-brand`}>
            ★ GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-6 pb-11 pt-16">
        <div className="mx-auto grid max-w-[1120px] items-center gap-11 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-ai">Code provenance layer</div>
            <h1 className="mt-5 text-balance font-display text-5xl font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
              See the <span className="text-human">human</span> and the <span className="text-ai">AI</span> grain in your code.
            </h1>
            <p className="mt-5 max-w-[46ch] text-xl text-muted">
              Grain measures how much of a repository was human-written vs AI-assisted — with a confidence level on every claim. Signals, not verdicts.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href={REPO} className={`${btnBase} bg-ink text-ground hover:-translate-y-px`}>★ Star on GitHub</a>
              <a href="#how" className={`${btnBase} border border-line-strong text-ink hover:border-brand hover:text-brand`}>See what it outputs</a>
            </div>
            <div className="mt-5 inline-flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3 font-mono text-sm">
              <span><span className="text-human">$</span> npx grain scan</span>
              <span className="text-xs text-faint">· MIT · runs locally</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_46px_rgba(32,29,25,0.09)]">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line px-[18px] py-3">
              <span className="font-mono text-xs">◆ acme/<span className="text-faint">payments-service</span></span>
              <span className="flex gap-3 font-mono text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />human</span>
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />AI</span>
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />uncl.</span>
              </span>
            </div>
            <div className="px-[18px]"><Fingerprint height={100} /></div>
            <div className="flex flex-wrap gap-6 border-t border-line px-[18px] py-3.5">
              {[
                { n: "73%", l: "human", c: "text-human" },
                { n: "22%", l: "AI-assisted", c: "text-ai" },
                { n: "5%", l: "uncl.", c: "text-faint" },
                { n: "400", l: "commits", c: "" },
              ].map((s) => (
                <div key={s.l}>
                  <div className={`font-display text-2xl font-bold tracking-tight ${s.c}`}>{s.n}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Why now */}
      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <SectionHead eyebrow="Why now" title="Two trends just collided in every repo.">
            AI writes code freely, and maintainers have grown wary of what it wrote. Between them sits an unmet need: a neutral way to measure provenance.
          </SectionHead>
          <div className="grid gap-[18px] md:grid-cols-2" style={{ gap: "18px" }}>
            {[
              {
                side: "ai" as const, k: "Trend 01", h: "AI commits on its own",
                p: "Agents open PRs, keep tool-activity logs, and push commits directly. A diff is no longer presumed human.",
                q: "“@OmniBlocks/boxy peace was never an option”", c: "— a developer replying to an AI bot on GitHub",
              },
              {
                side: "human" as const, k: "Trend 02", h: "Maintainers turned wary",
                p: "Projects are rewriting contribution policy to demand transparency about AI use — but disclosure is honor-system today.",
                q: "“To better reflect the community's AI-skeptical ('wary') sentiment, the policy itself has changed.”", c: "— maintainer, Bevy engine policy",
              },
            ].map((t) => (
              <div key={t.k} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-[26px]" style={{ padding: "26px" }}>
                <span className={`absolute inset-y-0 left-0 w-1 ${t.side === "ai" ? "bg-ai" : "bg-human"}`} />
                <div className="font-mono text-[11.5px] uppercase tracking-widest text-muted">{t.k}</div>
                <h3 className="mb-2 mt-2.5 font-display text-xl font-bold">{t.h}</h3>
                <p className="text-[15px] text-muted">{t.p}</p>
                <div className="mt-3.5 border-t border-dashed border-line-strong pt-3.5 text-[13.5px] italic">
                  {t.q}
                  <cite className="mt-1.5 block font-mono text-[11px] not-italic text-faint">{t.c}</cite>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center font-mono text-sm">
            The gap between them is <b className="text-brand">trust</b>. Grain is the instrument that measures it.
          </p>
        </div>
      </section>

      {/* Outputs */}
      <section id="how" className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <SectionHead eyebrow="What it outputs" title="One command in. Three things out.">
            No dashboard to learn. Grain meets developers where they already look — the badge, the PR, and a file in the repo.
          </SectionHead>
          <div className="grid gap-[18px] md:grid-cols-3" style={{ gap: "18px" }}>
            {/* badge */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex flex-1 items-center justify-center bg-surface-2 p-6">
                <div className="flex w-full flex-col items-center gap-3">
                  <Shield label="🌾 grain" value="22% AI-assisted" />
                  <ProvBar human={73} ai={22} unc={5} />
                </div>
              </div>
              <div className="p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ai">01 · Badge</div>
                <h3 className="mb-1 mt-1.5 font-display text-[17px] font-bold">A README shield</h3>
                <p className="text-[13.5px] text-muted">The repo&apos;s human/AI mix, the way a coverage badge shows tests.</p>
              </div>
            </div>
            {/* PR */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex flex-1 items-center justify-center bg-surface-2 p-6">
                <div className="w-full font-mono text-[11px] leading-[1.7]">
                  <div>grain report · #482</div>
                  <div>› <span className="font-semibold text-ai">62%</span> of +214 lines carry AI signals</div>
                  <div>› 2 files touch <span className="font-semibold text-human">src/auth/</span> (owned)</div>
                  <div>⚠ 1 human review requested</div>
                </div>
              </div>
              <div className="p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ai">02 · PR check</div>
                <h3 className="mb-1 mt-1.5 font-display text-[17px] font-bold">A calm comment</h3>
                <p className="text-[13.5px] text-muted">Itemized, framed as signals — never an accusation.</p>
              </div>
            </div>
            {/* provenance */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex flex-1 items-center justify-center bg-surface-2 p-6">
                <div className="w-full text-center">
                  <div className="font-display text-4xl font-extrabold tracking-tight text-human">73%</div>
                  <div className="mb-3 mt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted">human-authored</div>
                  <ProvBar human={73} ai={22} unc={5} />
                </div>
              </div>
              <div className="p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ai">03 · PROVENANCE.md</div>
                <h3 className="mb-1 mt-1.5 font-display text-[17px] font-bold">A nutrition label</h3>
                <p className="text-[13.5px] text-muted">A committable report of the whole repo, backed by grain.json.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detection */}
      <section id="detection" className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <SectionHead eyebrow="How it reads the grain" title="Forensics, ranked by confidence.">
            Grain starts from hard evidence and only falls back to inference — and it reports a confidence score, never an accusation.
          </SectionHead>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: "01", h: "Declared signals", p: "Co-Authored-By trailers, agent commits, bot accounts, explicit tags.", tag: "high confidence", hi: true },
              { i: "02", h: "Commit forensics", p: "Burst timing, diff uniformity, the “all at once” shape of agent output.", tag: "inferred", hi: false },
              { i: "03", h: "Convention diffing", p: "Did the change respect the repo's own style and CODEOWNERS?", tag: "inferred", hi: false },
              { i: "04", h: "Local model pass", p: "Optional, for ambiguous diffs. Runs client-side; code never leaves the machine.", tag: "privacy-first", hi: true },
            ].map((s) => (
              <div key={s.i} className="rounded-xl border border-line bg-surface p-5">
                <div className="font-mono text-xs font-semibold text-brand">{s.i}</div>
                <h3 className="mb-1.5 mt-2 font-display text-[15px] font-bold">{s.h}</h3>
                <p className="text-[13px] text-muted">{s.p}</p>
                <span className={`mt-2.5 inline-block rounded-full px-2 py-0.5 font-mono text-[10.5px] ${s.hi ? "bg-human-soft text-human" : "bg-ai-soft text-ai"}`}>{s.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy band */}
      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <div className="rounded-[22px] bg-ink px-10 py-14 text-center text-ground">
            <div className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: "#E28A50" }}>The principle</div>
            <h2 className="mt-3.5 font-display text-4xl font-bold text-ground sm:text-[46px]">
              Signals, <span style={{ color: "#E28A50" }}>not</span> verdicts.
            </h2>
            <p className="mx-auto mt-[18px] max-w-[56ch] text-[17px]" style={{ color: "rgba(236,233,225,0.6)" }}>
              Grain reports &ldquo;62% of these lines carry AI signals&rdquo; — never &ldquo;this person cheated&rdquo;. Inference is capped, declared signals are preferred, and it names its own limits.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <SectionHead eyebrow="Open core" title="The instrument is free. The org tooling is paid.">
            Everything that runs on a single repo, locally, is free and MIT. The open engine is what makes the numbers credible.
          </SectionHead>
          <div className="grid gap-[18px] md:grid-cols-3" style={{ gap: "18px" }}>
            {[
              { price: "MIT · free forever", h: "grain CLI", who: "Solo devs & OSS maintainers", feats: ["CLI, GitHub Action, badge", "PROVENANCE.md + grain.json", "Runs fully local", "The full detection engine"], cta: "★ Star on GitHub", href: REPO, feature: false },
              { price: "Team · join the waitlist", h: "grain Cloud", who: "Teams shipping with agents", feats: ["Org dashboard & trends", "Merge-policy engine", "Multi-repo rollups", "Slack / PR gating"], cta: "Join the waitlist", href: "#", feature: true },
              { price: "Compliance · talk to us", h: "grain Audit", who: "Regulated & enterprise", feats: ["Signed provenance ledger", "EU AI Act / SOC2 export", "SSO & retention policy", "On-prem option"], cta: "Contact us", href: "#", feature: false },
            ].map((t) => (
              <div key={t.h} className={`flex flex-col rounded-2xl border bg-surface p-[26px] ${t.feature ? "border-brand shadow-[0_18px_46px_rgba(32,29,25,0.09)]" : "border-line"}`} style={{ padding: "26px" }}>
                <div className={`font-mono text-xs uppercase tracking-wider ${t.feature ? "text-brand" : "text-muted"}`}>{t.price}</div>
                <h3 className="mb-1 mt-2 font-display text-xl font-bold">{t.h}</h3>
                <div className="mb-[18px] text-[13.5px] text-muted" style={{ marginBottom: "18px" }}>{t.who}</div>
                <ul className="mb-5 flex flex-col gap-2.5">
                  {t.feats.map((f) => (
                    <li key={f} className="relative pl-[22px] text-sm" style={{ paddingLeft: "22px" }}>
                      <span className="absolute left-0 font-mono text-brand">→</span>{f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <a href={t.href} className={`${btnBase} w-full justify-center ${t.feature ? "bg-ink text-ground hover:-translate-y-px" : "border border-line-strong text-ink hover:border-brand hover:text-brand"}`}>{t.cta}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line px-6 py-16 text-center">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="font-display text-4xl font-bold tracking-tight">See the grain of your codebase.</h2>
          <p className="mx-auto mb-[26px] mt-3.5 max-w-[50ch] text-lg text-muted" style={{ marginBottom: "26px" }}>
            One command. MIT. Runs locally. Star it, try it, and put a provenance badge on your repo today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={REPO} className={`${btnBase} bg-ink text-ground hover:-translate-y-px`}>★ Star on GitHub</a>
            <a href={`${REPO}#quickstart`} className={`${btnBase} border border-line-strong text-ink hover:border-brand hover:text-brand`}>Read the docs</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-9">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between font-mono text-[12.5px] text-muted">
          <span className="flex items-center gap-2 font-display text-[17px] font-extrabold text-ink">
            <Mark size={20} /> grain
          </span>
          <span>MIT · signals, not verdicts · © 2026</span>
        </div>
      </footer>
    </main>
  );
}
