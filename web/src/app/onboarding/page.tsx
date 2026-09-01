import Link from "next/link";
import { Mark } from "@/components/Mark";
import { Fingerprint } from "@/components/Fingerprint";

export default function Onboarding() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-ground p-10 text-ink">
      <div className="flex w-[760px] items-center justify-between">
        <div className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
          <Mark size={24} /> grain
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-faint">
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-brand" /> Step 3 of 3 — First scan
        </div>
      </div>

      <div className="mt-[22px] w-[760px] rounded-2xl border border-line bg-surface p-[44px] text-center shadow-[0_18px_46px_rgba(32,29,25,0.08)]">
        <h2 className="font-display text-[30px] font-extrabold tracking-tight">Reading the grain…</h2>
        <p className="mb-6 mt-2.5 text-[15px] text-muted">
          Grain is measuring authorship across your 3 repositories. This runs once; PRs update it from here.
        </p>

        <div className="rounded-xl border border-line bg-ground/40 p-[18px]">
          <Fingerprint height={72} bars={90} />
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-md border border-line-strong">
            <span className="bg-human" style={{ width: "71%" }} />
            <span className="bg-ai" style={{ width: "22%" }} />
            <span className="bg-line-strong" style={{ width: "7%" }} />
          </div>
          <div className="mt-2.5 flex justify-center gap-5 font-mono text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />71% human</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />22% AI</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />7% unclassified</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 text-left">
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
            <span className="text-[13.5px] font-medium">payments-service <span className="font-mono font-normal text-faint">FrontTribe/</span></span>
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11.5px] text-human">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="size-4"><path d="M5 12l4 4 10-10" /></svg>
              400 commits · done
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
            <span className="text-[13.5px] font-medium">auth-gateway <span className="font-mono font-normal text-faint">FrontTribe/</span></span>
            <span className="ml-auto inline-flex items-center gap-2 font-mono text-[11.5px] text-ai">
              <span className="size-3.5 animate-spin rounded-full border-2 border-ai-soft border-t-ai" />
              scanning 218 / 340
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
            <span className="text-[13.5px] font-medium">web-app <span className="font-mono font-normal text-faint">FrontTribe/</span></span>
            <span className="ml-auto font-mono text-[11.5px] text-faint">queued</span>
          </div>
        </div>

        <Link href="/app" className="mt-7 inline-flex h-[46px] items-center gap-2.5 rounded-[10px] bg-brand px-6 text-[14.5px] font-semibold text-white">
          Go to dashboard
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
        <div className="mt-3 font-mono text-[12.5px] text-faint">You can leave — we&apos;ll email you when the first scan finishes.</div>
      </div>
    </div>
  );
}
