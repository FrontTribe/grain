import { TopBar, Card, Spark, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { SelectNav } from "@/components/dashboard/controls";
import { getOrgTrend, getRepoTrends } from "@/lib/data";

export default async function Trends({ searchParams }: { searchParams: Promise<{ repo?: string }> }) {
  const { repo } = await searchParams;
  const repos = await getRepoTrends();
  const selected = repos.find((r) => r.name === repo) ?? null;
  const orgTrend = await getOrgTrend(selected?.id);

  const shownRepos = selected ? repos.filter((r) => r.id === selected.id) : repos;
  const orgAi = orgTrend.at(-1)?.ai ?? (repos.length ? Math.round(repos.reduce((s, r) => s + r.ai, 0) / repos.length) : 0);
  const yoy = orgTrend.length > 1 ? orgTrend.at(-1)!.ai - orgTrend[0].ai : 0;
  const over40 = repos.filter((r) => r.ai > 40).length;
  const top = repos[0];
  const trend = { months: orgTrend.map((t) => t.month), human: orgTrend.map((t) => t.human), ai: orgTrend.map((t) => t.ai), threshold: 40 };
  const scopeLabel = selected ? selected.name : "organization";
  const repoOptions = [{ value: "", label: "All repositories" }, ...repos.map((r) => ({ value: r.name, label: r.name }))];

  return (
    <>
      <TopBar
        title="Trends"
        right={<SelectNav param="repo" value={selected?.name ?? ""} options={repoOptions} mono ariaLabel="Filter by repository" />}
      />
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {selected ? (
            <>
              <Kpi label={`${selected.name} · AI-assisted`} value={`${selected.ai}%`} valueClass="text-ai">
                {selected.delta !== 0 && <span className={`rounded px-1.5 py-0.5 font-mono ${selected.delta > 0 ? "bg-ai-soft text-ai" : "bg-human-soft text-human"}`}>{selected.delta > 0 ? "▲ +" : "▼ "}{selected.delta} pts</span>}{" "}
                {selected.delta !== 0 ? "since first scan" : "current"}
              </Kpi>
              <Kpi label="Trend Δ" value={`${selected.delta > 0 ? "+" : ""}${selected.delta} pts`} valueClass={selected.delta > 0 ? "text-ai" : selected.delta < 0 ? "text-human" : ""}>
                first scan → latest
              </Kpi>
              <Kpi label="Attention status" value={selected.ai > 40 ? "Over" : "Under"} valueClass={selected.ai > 40 ? "text-ai !text-[26px]" : "text-human !text-[26px]"}>
                the 40% policy threshold
              </Kpi>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold">Authorship over time — {scopeLabel}</h3>
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
              {shownRepos.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name} <span className="font-mono font-normal text-faint">{r.owner}/</span></td>
                  <td className="font-mono tabular-nums">{r.ai}%</td>
                  <td><Spark series={r.series} w={120} h={24} up={r.delta > 0} /></td>
                  <td className={`font-mono tabular-nums ${r.delta > 0 ? "text-ai" : r.delta < 0 ? "text-human" : "text-faint"}`}>
                    {r.delta > 0 ? `+${r.delta}` : r.delta} pts
                  </td>
                </tr>
              ))}
              {shownRepos.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-[13px] text-faint">No repositories yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
