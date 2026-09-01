import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Mark";
import { Fingerprint } from "@/components/Fingerprint";
import { getRepos, num } from "@/lib/data";

export default async function Onboarding() {
  const repos = await getRepos();
  // Nothing scanned yet → send them back to pick repositories.
  if (repos.length === 0) redirect("/connect");

  const n = repos.length;
  const avg = (sel: (r: (typeof repos)[number]) => number) =>
    Math.round(repos.reduce((s, r) => s + num(sel(r)), 0) / n);
  const human = avg((r) => r.human);
  const ai = avg((r) => r.ai);
  const unc = Math.max(0, 100 - human - ai);

  return (
    <div className="flex min-h-screen flex-col items-center bg-ground p-10 text-ink">
      <div className="flex w-[760px] items-center justify-between">
        <div className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
          <Mark size={24} /> grain
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-faint">
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-[#57C6A8]" /> Step 3 of 3 — First scan
        </div>
      </div>

      <div className="mt-[22px] w-[760px] rounded-2xl border border-line bg-surface p-[44px] text-center shadow-[0_18px_46px_rgba(32,29,25,0.08)]">
        <h2 className="font-display text-[30px] font-extrabold tracking-tight">Your grain is in.</h2>
        <p className="mb-6 mt-2.5 text-[15px] text-muted">
          Grain measured authorship across {n} {n === 1 ? "repository" : "repositories"}. Pull requests update it from here.
        </p>

        <div className="rounded-xl border border-line bg-ground/40 p-[18px]">
          <Fingerprint height={72} bars={90} />
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-md border border-line-strong">
            <span className="bg-human" style={{ width: `${human}%` }} />
            <span className="bg-ai" style={{ width: `${ai}%` }} />
            <span className="bg-line-strong" style={{ width: `${unc}%` }} />
          </div>
          <div className="mt-2.5 flex justify-center gap-5 font-mono text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />{human}% human</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{ai}% AI</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />{unc}% unclassified</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 text-left">
          {repos.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
              <span className="text-[13.5px] font-medium">
                {r.name} <span className="font-mono font-normal text-faint">{r.full_name?.split("/")[0] ?? ""}/</span>
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11.5px] text-human">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="size-4"><path d="M5 12l4 4 10-10" /></svg>
                {num(r.ai)}% AI · done
              </span>
            </div>
          ))}
        </div>

        <Link href="/app" className="mt-7 inline-flex h-[46px] items-center gap-2.5 rounded-[10px] bg-brand px-6 text-[14.5px] font-semibold text-white">
          Go to dashboard
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
        <div className="mt-3 font-mono text-[12.5px] text-faint">Add more repositories anytime from Settings.</div>
      </div>
    </div>
  );
}
