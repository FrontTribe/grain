import Link from "next/link";
import { Mark } from "@/components/Mark";

const checkbox = (on: boolean) => (
  <span className={`flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] ${on ? "border-brand bg-brand text-white" : "border-line-strong"}`}>
    {on && (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
        <path d="M5 12l4 4 10-10" />
      </svg>
    )}
  </span>
);

const repos = [
  { name: "payments-service", vis: "private", on: true },
  { name: "auth-gateway", vis: "private", on: true },
  { name: "web-app", vis: "private", on: true },
  { name: "design-tokens", vis: "public", on: false },
  { name: "infra", vis: "private", on: false },
];

export default function Connect() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-ground p-10 text-ink">
      <div className="flex w-[720px] items-center justify-between">
        <div className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
          <Mark size={24} /> grain
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-faint">
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-brand" />
          <span className="size-2 rounded-full bg-line-strong" /> Step 2 of 3 — Connect
        </div>
      </div>

      <div className="mt-[18px] w-[720px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_46px_rgba(32,29,25,0.08)]">
        <div className="border-b border-line px-[30px] pb-5 pt-[26px]">
          <h2 className="font-display text-2xl font-bold">Install the Grain GitHub App</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-muted">
            Grain reads commit metadata and pull-request events to measure provenance. It never sends your source code to our servers.
          </p>
        </div>

        <div className="px-[30px] py-[22px]">
          <div className="mb-[18px] flex items-center gap-3">
            <span className="w-[120px] text-[13px] font-medium">Organization</span>
            <div className="flex h-11 flex-1 items-center rounded-[10px] border border-line bg-surface px-3.5 text-sm">
              <span className="mr-2.5 size-[22px] rounded-md bg-gradient-to-br from-[#57C6A8] to-[#E28A50]" />
              FrontTribe <span className="ml-auto text-faint">▾</span>
            </div>
          </div>

          <div className="mb-4 flex gap-3">
            <div className="flex flex-1 items-start gap-3 rounded-xl border border-line p-3.5">
              <span className="mt-0.5 size-[18px] flex-none rounded-full border-2 border-line-strong" />
              <div><div className="text-[13.5px] font-semibold">All repositories</div><div className="mt-1 text-[12px] text-muted">Current and future repos in FrontTribe.</div></div>
            </div>
            <div className="flex flex-1 items-start gap-3 rounded-xl border border-brand bg-human-soft p-3.5">
              <span className="mt-0.5 size-[18px] flex-none rounded-full border-2 border-brand" style={{ background: "radial-gradient(circle at center, var(--brand) 0 5px, transparent 6px)" }} />
              <div><div className="text-[13.5px] font-semibold">Only select repositories</div><div className="mt-1 text-[12px] text-muted">Choose which repos Grain can see.</div></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            {repos.map((r) => (
              <div key={r.name} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-none">
                {checkbox(r.on)}
                <span className="text-[13.5px] font-medium">{r.name} <span className="font-mono font-normal text-faint">FrontTribe/</span></span>
                <span className="ml-auto rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10.5px] text-muted">{r.vis}</span>
              </div>
            ))}
          </div>

          <div className="mt-[18px] rounded-[10px] border border-line bg-surface-2 px-4 py-3.5 text-[12.5px] text-ink">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Permissions grain requests</div>
            <div className="mt-1.5"><span className="font-semibold text-human">Read</span> — repository metadata, commits, pull requests, contents (checksum only)</div>
            <div className="mt-1.5"><span className="font-semibold text-ai">Write</span> — checks &amp; commit statuses, pull-request comments</div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-[30px] py-[18px]">
          <Link href="/login" className="flex h-11 items-center rounded-[10px] border border-line bg-surface px-5 text-[14px] font-semibold text-muted">Cancel</Link>
          <Link href="/onboarding" className="flex h-11 items-center rounded-[10px] bg-brand px-5 text-[14px] font-semibold text-white">Install &amp; authorize</Link>
        </div>
      </div>
      <div className="mt-3.5 w-[720px] text-center text-[12px] text-faint">You can change repository access anytime in Settings → Integrations.</div>
    </div>
  );
}
