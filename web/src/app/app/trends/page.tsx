import { TopBar, Card, Spark, Kpi } from "@/components/dashboard/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { getOrgScans, getRepos, monthLabel, num } from "@/lib/data";
import { teams } from "@/lib/mock";

const chip = "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted";

export default async function Trends() {
  const [scans, repos] = await Promise.all([getOrgScans(), getRepos()]);
  const orgAi = num(scans.at(-1)?.ai ?? 0);
  const yoy = scans.length > 1 ? orgAi - num(scans[0].ai) : 0;
  const over40 = repos.filter((r) => num(r.ai) > 40).length;
  const fastest = [...repos].sort((a, b) => num(b.ai) - num(a.ai))[0];
  const trend = { months: scans.map((s) => monthLabel(s.created_at)), human: scans.map((s) => num(s.human)), ai: scans.map((s) => num(s.ai)), threshold: 40 };

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
          <Kpi label="Org AI-assisted" value={`${orgAi}%`} valueClass="text-ai">
            {yoy !== 0 && <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-ai">▲ +{yoy} pts</span>} since first scan
          </Kpi>
          <Kpi label="Highest-AI repo" value={fastest?.name ?? "—"} valueClass="!text-[26px]">
            currently <b className="text-ink">{num(fastest?.ai ?? 0)}% AI</b>
          </Kpi>
          <Kpi label="Repos over 40% AI" value={`${over40}`}>
            of {repos.length} tracked repositories
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
          <TrendChart months={trend.months} human={trend.human} ai={trend.ai} threshold={trend.threshold} height={300} />
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
