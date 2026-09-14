import Link from "next/link";
import { Mark } from "@/components/Mark";
import { BlameReveal } from "@/components/marketing/BlameReveal";
import { BLAME_FILE, BLAME_LINES, BLAME_SUMMARY } from "@/lib/self-blame";
import { FREE_LIMITS } from "@/lib/plan";

// The shell every auth page shares. Left: the product's answer, as it is,
// the same real `grain blame` view the landing page opens with. Right: the
// form in a card. Same tokens as the rest of the site in both themes, so the
// step from landing to sign-in doesn't feel like a different product.
export function AuthShell({ children, step }: { children: React.ReactNode; step?: 1 | 2 | 3 }) {
  return (
    <div className="min-h-[100dvh] bg-ground text-ink lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
      <aside className="hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-10 xl:px-20">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
          <Mark size={22} /> grain
        </Link>
        <div className="max-w-[520px]">
          <h2 className="rise text-balance font-display text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em]" style={{ "--i": 0 } as React.CSSProperties}>
            Know which lines the <span className="text-ai">AI</span> wrote.
          </h2>
          <p className="rise mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-muted" style={{ "--i": 1 } as React.CSSProperties}>
            Recorded when the agent writes it, signed into git, verifiable by anyone. This is grain reading its own repository.
          </p>
          <div className="rise hero-card mt-8 rounded-[14px]" style={{ "--i": 2 } as React.CSSProperties}>
            <BlameReveal
              file={BLAME_FILE}
              lines={BLAME_LINES}
              summary={<>{BLAME_SUMMARY.lines} lines, <span className="text-ai">{BLAME_SUMMARY.ai} AI-written</span> ({BLAME_SUMMARY.pct}%), attested from git notes</>}
            />
          </div>
        </div>
        <p className="text-[12.5px] text-faint">MIT engine. Your code is never uploaded.</p>
      </aside>

      <main className="flex min-h-[100dvh] flex-col bg-surface px-5 py-6 sm:px-8 lg:min-h-0 lg:justify-center lg:border-l lg:border-line lg:px-14 lg:py-12 xl:px-20">
        <div className="lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
            <Mark size={22} /> grain
          </Link>
        </div>
        <div className="my-auto w-full max-w-[420px] py-10 lg:my-0 lg:py-0">
          {step && <Steps current={step} />}
          <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>{children}</div>
          <p className="mt-8 text-[12.5px] text-faint lg:hidden">
            Free for {FREE_LIMITS.repos} repositories and {FREE_LIMITS.seats} seats. MIT engine, code never uploaded.
          </p>
        </div>
      </main>
    </div>
  );
}

// The three steps between here and a first scan: a real sequence, so it is
// shown as one. Quietly tells a new user how short the path is.
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const items = ["Create workspace", "Connect GitHub", "First scan"];
  return (
    <ol className="rise mb-7 flex items-center gap-2 text-[12px]" style={{ "--i": 0 } as React.CSSProperties} aria-label="Setup progress">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < current ? "done" : n === current ? "now" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={state === "now" ? "step" : undefined}
              className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-medium ${
                state === "now" ? "bg-ink text-ground" : state === "done" ? "bg-human-soft text-human" : "border border-line text-muted"
              }`}
            >
              <span className="font-mono text-[11px]">{n}</span>
              <span className={state === "now" ? "" : "hidden sm:inline"}>{label}</span>
            </span>
            {i < items.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// Shared form pieces so the three pages stay identical in rhythm.
export const fieldCls =
  "h-11 w-full rounded-[10px] border border-line bg-ground px-3.5 text-[14.5px] text-ink outline-none placeholder:text-faint transition-[border-color,box-shadow] focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ink)_12%,transparent)]";
export const primaryBtn = "press flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[14.5px] font-semibold text-ground";
export const secondaryBtn = "press flex h-11 w-full items-center justify-center rounded-[10px] border border-line-strong bg-ground text-[14.5px] font-semibold text-ink hover:border-ink";

export function Label({ htmlFor, children, right }: { htmlFor: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">{children}</label>
      {right}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const cls = tone === "error" ? "border-ai/40 bg-ai-soft text-ai" : "border-human/40 bg-human-soft text-human";
  return <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-[10px] border px-3.5 py-2.5 text-[13px] ${cls}`}>{children}</div>;
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3.5 text-[12px] text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
      or with email
    </div>
  );
}

// GitHub's mark (brand asset), used only on the sign-in buttons.
export function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
