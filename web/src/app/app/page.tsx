import { TopBar, Card, ProvBar, MiniBar, Spark, Pill, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { org, kpis, trend6, attention, repos } from "@/lib/mock";

const chip = "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-muted";

export default function Overview() {
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
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Org provenance" value={`${kpis.human}%`} valueClass="text-human">
            human-authored across {org.repos} repos
            <ProvBar human={kpis.human} ai={kpis.ai} unc={kpis.unc} h={8} />
          </Kpi>
          <Kpi label="AI-assisted" value={`${kpis.ai}%`} valueClass="text-ai">
            <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-ai">▲ +{kpis.aiDeltaPts} pts</span> vs last month
          </Kpi>
          <Kpi label="Open attention" value={`${kpis.openAttention}`}>
            PRs over policy in human-owned paths
          </Kpi>
          <Kpi label="Coverage" value={`${org.repos}`}>
            repos tracked · {org.scannedToday} scanned today
          </Kpi>
        </div>

        {/* trend + attention */}
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
            <TrendChart months={trend6.months} human={trend6.human} ai={trend6.ai} threshold={trend6.threshold} height={210} />
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
            </div>
          </Card>
        </div>

        {/* repo table */}
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
                <tr key={r.name}>
                  <td className="font-medium">{r.name} <span className="font-mono font-normal text-faint">acme/</span></td>
                  <td><MiniBar human={r.human} ai={r.ai} /></td>
                  <td className="font-mono tabular-nums">{r.ai}%</td>
                  <td><Spark series={r.spark} up={r.ai > r.human || r.status === "attention"} /></td>
                  <td><Pill tone={r.status === "attention" ? "attention" : "ok"}>{r.status}</Pill></td>
                  <td className="font-mono tabular-nums text-faint">{r.lastScan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
