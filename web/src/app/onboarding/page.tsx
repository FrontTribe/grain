import Link from "next/link";
import { redirect } from "next/navigation";
import { getRepos, num } from "@/lib/data";
import { FlowShell, primaryBtn } from "@/components/AuthShell";

export const metadata = { title: "First scan" };

// Step three of setup: the first scan landed. Real numbers from the repos the
// user just connected, then straight into the dashboard.
export default async function Onboarding() {
  const repos = await getRepos();
  // Nothing scanned yet: send them back to pick repositories.
  if (repos.length === 0) redirect("/connect");

  const n = repos.length;
  const avg = (sel: (r: (typeof repos)[number]) => number) =>
    Math.round(repos.reduce((s, r) => s + num(sel(r)), 0) / n);
  const human = avg((r) => r.human);
  const ai = avg((r) => r.ai);
  const unc = Math.max(0, 100 - human - ai);

  return (
    <FlowShell step={4}>
      <div className="px-6 py-8 sm:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Your first scan is in.</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          Authorship measured across {n} {n === 1 ? "repository" : "repositories"}. Every push to a default branch updates it from here.
        </p>

        <div className="mt-7 flex h-3 gap-0.5 overflow-hidden rounded-md" aria-hidden>
          <span className="bg-human" style={{ width: `${human}%` }} />
          <span className="bg-ai" style={{ width: `${ai}%` }} />
          <span className="bg-line-strong" style={{ width: `${unc}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-5 font-mono text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />{human}% human</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{ai}% AI-assisted</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />{unc}% unclassified</span>
        </div>

        <ul className="mt-7 divide-y divide-line border-y border-line">
          {repos.slice(0, 8).map((r) => {
            const rh = num(r.human);
            const ra = num(r.ai);
            return (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_120px_4rem] items-center gap-4 py-3 text-[13.5px]">
                <span className="truncate font-medium">
                  {r.name} <span className="font-mono text-[12px] font-normal text-faint">{r.full_name?.split("/")[0] ?? ""}/</span>
                </span>
                <span className="flex h-2 gap-0.5 overflow-hidden rounded-sm" aria-hidden>
                  <span className="bg-human" style={{ width: `${rh}%` }} />
                  <span className="bg-ai" style={{ width: `${ra}%` }} />
                </span>
                <span className="text-right font-mono text-[12.5px] text-ai">{ra}% AI</span>
              </li>
            );
          })}
        </ul>
        {n > 8 && <p className="mt-2 text-[12.5px] text-faint">and {n - 8} more</p>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/app" className={`${primaryBtn} w-auto px-6`}>Open the dashboard</Link>
          <span className="text-[12.5px] text-muted">Add repositories any time from Settings.</span>
        </div>
      </div>
    </FlowShell>
  );
}
