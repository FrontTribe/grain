import { TopBar, Card, MiniBar } from "@/components/dashboard/ui";
import { Fingerprint } from "@/components/Fingerprint";
import { repoDetail } from "@/lib/mock";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

export default async function RepoDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const d = repoDetail;

  return (
    <>
      <TopBar
        title=""
        right={
          <>
            <span className={`${btn} border border-line bg-surface text-muted`}>Re-scan</span>
            <span className={`${btn} bg-brand text-surface`}>Configure policy</span>
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-7">
        <div className="-mt-2 font-mono text-sm text-muted">
          Repositories / <span className="font-display text-lg font-bold text-ink">{name}</span>
        </div>

        {/* hero */}
        <Card className="grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-[210px_1fr_auto]">
          <div>
            <div className="font-display text-6xl font-extrabold leading-none tracking-tighter text-human">{d.human}%</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">human-authored</div>
          </div>
          <div>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-lg border border-line-strong">
              <span className="bg-human" style={{ width: `${d.human}%` }} />
              <span className="bg-ai" style={{ width: `${d.ai}%` }} />
              <span className="bg-line-strong" style={{ width: `${d.unc}%` }} />
            </div>
            <div className="mt-2.5 flex gap-4 font-mono text-[12.5px] text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />{d.human}% human</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{d.ai}% AI</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />{d.unc}% uncl.</span>
            </div>
            <div className="mt-3 text-[12.5px] text-muted">
              Human-owned:{" "}
              {d.owned.map((p) => (
                <code key={p} className="mr-1 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">{p}</code>
              ))}
              · {d.commits} commits · last scan {d.lastScan}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex overflow-hidden rounded border border-line font-mono text-xs">
              <span className="bg-ink px-2 py-1 text-ground">grain</span>
              <span className="bg-surface-2 px-2 py-1 font-semibold">{d.ai}% AI-assisted</span>
            </span>
          </div>
        </Card>

        {/* fingerprint */}
        <Card className="p-5">
          <div className="mb-2.5 flex flex-wrap gap-3.5 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />human</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />AI-assisted</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />unclassified</span>
            <span className="text-faint">· {d.commits} commits, oldest → newest</span>
          </div>
          <Fingerprint height={84} bars={120} />
        </Card>

        {/* by-dir + PRs */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold">By directory</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="[&_th]:border-b [&_th]:border-line/60 [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                  <th>Path</th><th>Mix</th><th>Human / AI</th><th></th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-line/50 [&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[12.5px] [&_tr:last-child_td]:border-none">
                {d.byDir.map((row) => (
                  <tr key={row.path}>
                    <td className="font-mono">{row.path}</td>
                    <td><MiniBar human={row.human} ai={row.ai} width={96} /></td>
                    <td className="font-mono tabular-nums">{row.human} / {row.ai}</td>
                    <td>{row.owned && <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-[10px] text-ai">human-owned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold">Recent pull requests</h3>
            <div className="flex flex-col">
              {d.prs.map((pr) => (
                <div key={pr.pr} className="flex items-center gap-2.5 border-b border-line/50 py-2.5 last:border-none">
                  <span className={`size-2 flex-none rounded-full ${pr.ai >= 40 ? "bg-ai" : "bg-human"}`} />
                  <span className="text-[12.5px]">{pr.title} <span className="font-mono text-faint">#{pr.pr}</span></span>
                  <span className={`ml-auto font-mono text-[12px] font-semibold ${pr.ai >= 40 ? "text-ai" : "text-human"}`}>{pr.ai}% AI</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
