import { TopBar, Card, Spark, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { getOrgTrend, getRepoTrends, num } from "@/lib/data";

const chip = "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted";

export default async function Trends() {
  const [orgTrend, repos] = await Promise.all([getOrgTrend(), getRepoTrends()]);

  const orgAi = orgTrend.at(-1)?.ai ?? (repos.length ? Math.round(repos.reduce((s, r) => s + r.ai, 0) / repos.length) : 0);
  const yoy = orgTrend.length > 1 ? orgTrend.at(-1)!.ai - orgTrend[0].ai : 0;
  const over40 = repos.filter((r) => r.ai > 40).length;
  const top = repos[0];
  const trend = { months: orgTrend.map((t) => t.month), human: orgTrend.map((t) => t.human), ai: orgTrend.map((t) => t.ai), threshold: 40 };

  return (
    <>
      <TopBar title="Trends" right={<span className={chip}>All repositories ▾</span>} />
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Org AI-assisted" value={`${orgAi}%`} valueClass="text-ai">
            {yoy !== 0 && <span className={`rounded px-1.5 py-0.5 font-mono ${yoy > 0 ? "bg-ai-soft text-ai" : "bg-human-soft text-human"}`}>{yoy > 0 ? "▲ +" : "▼ "}{yoy} pts</span>}{" "}
            {orgTrend.length > 1 ? "since first scan" : "current"}
          </Kpi>
          <Kpi label="Highest-AI repo" value={top?.name ?? "—"} valueClass="!text-[26px]">
            currently <b className="text-ink">{top ? top.ai : 0}% AI</b>
          </Kpi>
          <Kpi label="Repos over 40% AI" value={`${over40}`}>
            of {repos.length} tracked {repos.length === 1 ? "repository" : "repositories"}
          </Kpi>
        </div>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold">Authorship over time — organization</h3>
            <div className="flex gap-3.5 font-mono text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />human</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />AI-assisted</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />policy 40%</span>
            </div>
          </div>
          {orgTrend.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-faint">No scan history yet — scans appear here as they land.</div>
          ) : (
            <TrendChart months={trend.months} human={trend.human} ai={trend.ai} threshold={trend.threshold} height={300} />
          )}
        </Card>

        <Card className="px-2 pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th className="rounded-tl-lg">Repository</th><th>AI-assisted</th><th>Scan trend</th><th className="rounded-tr-lg">Δ first → last</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
              {repos.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name} <span className="font-mono font-normal text-faint">{r.owner}/</span></td>
                  <td className="font-mono tabular-nums">{r.ai}%</td>
                  <td><Spark series={r.series} w={120} h={24} up={r.delta > 0} /></td>
                  <td className={`font-mono tabular-nums ${r.delta > 0 ? "text-ai" : r.delta < 0 ? "text-human" : "text-faint"}`}>
                    {r.delta > 0 ? `+${r.delta}` : r.delta} pts
                  </td>
                </tr>
              ))}
              {repos.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-[13px] text-faint">No repositories yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
