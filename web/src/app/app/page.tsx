import { TopBar, Card, ProvBar, MiniBar, Spark, Pill, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { getRepos, getOrgScans, getEvents, ago, monthLabel, num } from "@/lib/data";

const chip = "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-muted";

// derive a gentle sparkline from a repo's current AI share (no per-repo history yet)
function spark(ai: number, attention: boolean): number[] {
  const end = Math.min(0.95, ai / 100);
  const start = Math.max(0.05, end - (attention ? 0.22 : 0.05));
  return Array.from({ length: 6 }, (_, i) => start + ((end - start) * i) / 5);
}

export default async function Overview() {
  const [repos, scans, events] = await Promise.all([getRepos(), getOrgScans(), getEvents()]);
  const last = scans.at(-1);
  const prev = scans.at(-2);
  const kpis = {
    human: num(last?.human ?? 0),
    ai: num(last?.ai ?? 0),
    unc: num(last?.unc ?? 0),
    aiDelta: last && prev ? num(last.ai) - num(prev.ai) : 0,
    attention: repos.filter((r) => r.status === "attention").length,
    coverage: repos.length,
  };
  const trend = {
    months: scans.map((s) => monthLabel(s.created_at)),
    human: scans.map((s) => num(s.human)),
    ai: scans.map((s) => num(s.ai)),
    threshold: 40,
  };
  const attention = events
    .filter((e) => e.kind === "attention" && e.pr)
    .slice(0, 5)
    .map((e) => ({ repo: e.repo!, pr: e.pr!, ai: num(e.ai ?? 0), ago: ago(e.created_at) }));

  return (
    <>
      <TopBar
        title="Overview"
        right={
          <>
            <span className={`${chip} font-mono text-xs`}>Last 6 months ▾</span>
            <span className={chip}>Search repos…</span>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-7">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Org provenance" value={`${kpis.human}%`} valueClass="text-human">
            human-authored across {kpis.coverage} repos
            <ProvBar human={kpis.human} ai={kpis.ai} unc={kpis.unc} h={8} />
          </Kpi>
          <Kpi label="AI-assisted" value={`${kpis.ai}%`} valueClass="text-ai">
            {kpis.aiDelta !== 0 && (
              <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-ai">▲ +{kpis.aiDelta} pts</span>
            )}{" "}
            vs last month
          </Kpi>
          <Kpi label="Open attention" value={`${kpis.attention}`}>
            repos flagged in human-owned paths
          </Kpi>
          <Kpi label="Coverage" value={`${kpis.coverage}`}>
            repositories tracked
          </Kpi>
        </div>

        <div className="grid gap-[18px] lg:grid-cols-[1.9fr_1fr]">
          <Card className="p-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold">Authorship over time</h3>
              <div className="flex gap-3.5 font-mono text-[11.5px] text-muted">
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />human</span>
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />AI-assisted</span>
                <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />policy 40%</span>
              </div>
            </div>
            <TrendChart months={trend.months} human={trend.human} ai={trend.ai} threshold={trend.threshold} height={210} />
          </Card>

          <Card className="p-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold">Needs attention</h3>
              <span className="font-mono text-[11px] text-faint">{attention.length} open</span>
            </div>
            <div className="flex flex-col">
              {attention.map((a) => (
                <div key={a.pr} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-none">
                  <span className="size-2 flex-none rounded-full bg-ai" />
                  <span className="text-[13px] font-medium">
                    {a.repo} <span className="font-mono font-normal text-faint">#{a.pr}</span>
                  </span>
                  <span className="ml-auto font-mono text-[12.5px] font-semibold text-ai">{a.ai}%</span>
                  <span className="w-10 text-right font-mono text-[11px] text-faint">{a.ago}</span>
                </div>
              ))}
              {attention.length === 0 && <div className="py-6 text-center text-[13px] text-faint">Nothing needs attention 🎉</div>}
            </div>
          </Card>
        </div>

        <Card className="px-2 pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th className="rounded-tl-lg">Repository</th>
                <th>Provenance mix</th>
                <th>AI</th>
                <th>30-day trend</th>
                <th>Status</th>
                <th className="rounded-tr-lg">Last scan</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
              {repos.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name} <span className="font-mono font-normal text-faint">acme/</span></td>
                  <td><MiniBar human={num(r.human)} ai={num(r.ai)} /></td>
                  <td className="font-mono tabular-nums">{num(r.ai)}%</td>
                  <td><Spark series={spark(num(r.ai), r.status === "attention")} up={r.status === "attention"} /></td>
                  <td><Pill tone={r.status === "attention" ? "attention" : "ok"}>{r.status}</Pill></td>
                  <td className="font-mono tabular-nums text-faint">{r.last_scan_at ? ago(r.last_scan_at) + " ago" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
