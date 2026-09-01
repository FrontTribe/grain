import { TopBar, Card, Spark, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { trend12, trendsKpis, teams } from "@/lib/mock";

const chip = "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted";

export default function Trends() {
  return (
    <>
      <TopBar
        title="Trends"
        right={
          <>
            <span className={chip}>Team: All ▾</span>
            <span className={chip}>Language: All ▾</span>
            <span className={chip}>Last 12 months ▾</span>
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Org AI-assisted" value={`${trendsKpis.orgAi}%`} valueClass="text-ai">
            <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-ai">▲ +{trendsKpis.yoy} pts</span> year over year
          </Kpi>
          <Kpi label="Fastest-rising repo" value={trendsKpis.fastest} valueClass="!text-[26px]">
            AI share up <b className="text-ink">+{trendsKpis.fastestDelta} pts</b> in 12 months
          </Kpi>
          <Kpi label="Repos over 40% AI" value={`${trendsKpis.over40}`}>
            of 42 tracked repositories
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
          <TrendChart months={trend12.months} human={trend12.human} ai={trend12.ai} threshold={trend12.threshold} height={300} />
        </Card>

        <Card className="px-2 pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th className="rounded-tl-lg">Team</th><th>Repos</th><th>AI-assisted</th><th>12-month trend</th><th className="rounded-tr-lg">Δ YoY</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
              {teams.map((t) => (
                <tr key={t.name}>
                  <td className="font-medium">{t.name}</td>
                  <td className="font-mono tabular-nums">{t.repos}</td>
                  <td className="font-mono tabular-nums">{t.ai}%</td>
                  <td><Spark series={t.spark} w={120} h={24} up={t.up} /></td>
                  <td className="font-mono tabular-nums text-ai">+{t.yoy} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
