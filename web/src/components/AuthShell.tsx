import Link from "next/link";
import { Mark } from "@/components/Mark";
import { Fingerprint } from "@/components/Fingerprint";
import { SELF_SCAN, SELF_COMMITS } from "@/lib/self-scan";
import { FREE_LIMITS } from "@/lib/plan";

// The shell every auth page shares: the landing page's claim and proof on the
// left, the form on the right. Same tokens as the rest of the site, so the
// step from landing to sign-in doesn't feel like a different product.
export function AuthShell({ children, aside = true }: { children: React.ReactNode; aside?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-ground text-ink lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {aside ? (
        <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col lg:p-12">
          <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
            <Mark size={22} /> grain
          </Link>
          <div className="mt-auto">
            <h2 className="max-w-[16ch] text-balance font-display text-[36px] font-extrabold leading-[1.04] tracking-[-0.03em]">
              Know which lines the <span className="text-ai">AI</span> wrote.
            </h2>
            <ul className="mt-6 flex flex-col gap-2.5 text-[14.5px] text-muted">
              <li>Reads your git history locally or through the GitHub App. Code is never uploaded.</li>
              <li>Attestations are signed into git and verifiable by anyone.</li>
              <li>Free for {FREE_LIMITS.repos} repositories and {FREE_LIMITS.seats} seats. No card.</li>
            </ul>
            <div className="mt-9 rounded-[14px] border border-line bg-ground px-4 py-3">
              <Fingerprint height={56} data={SELF_COMMITS} />
              <div className="mt-2 font-mono text-[11.5px] text-muted">
                grain on its own repository: {s(SELF_SCAN.commits)} commits, <span className="text-ai">{SELF_SCAN.ai}% AI-assisted</span>
              </div>
            </div>
          </div>
        </aside>
      ) : (
        <div className="hidden lg:block" />
      )}

      <main className="flex min-h-[100dvh] flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:justify-center lg:px-16 lg:py-12">
        <div className={aside ? "lg:hidden" : ""}>
          <Link href="/" className="inline-flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
            <Mark size={22} /> grain
          </Link>
        </div>
        <div className="my-auto w-full max-w-[400px] py-10 lg:my-0 lg:py-0">{children}</div>
      </main>
    </div>
  );
}

function s(n: number): string {
  return n.toLocaleString("en-US");
}

// Shared form pieces so the three pages stay identical in rhythm.
export const fieldCls = "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14.5px] text-ink outline-none placeholder:text-faint focus:border-ink";
export const primaryBtn = "press flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[14.5px] font-semibold text-ground";
export const secondaryBtn = "press flex h-11 w-full items-center justify-center rounded-[10px] border border-line-strong text-[14.5px] font-semibold text-ink hover:border-ink";

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
