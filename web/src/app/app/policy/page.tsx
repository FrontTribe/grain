import { TopBar, Card } from "@/components/dashboard/ui";
import { PolicyForm } from "@/components/dashboard/PolicyForm";
import { getOrgPolicy, getRepoPolicies } from "@/lib/data";

export default async function Policy({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const [policy, overrides] = await Promise.all([getOrgPolicy(), getRepoPolicies()]);
  const threshold = policy ? Math.round(policy.threshold * 100) : 40;
  const floor = policy ? policy.confidence_floor : 0.5;
  const enforcement = policy?.enforcement ?? "comment";
  const humanOwned = policy?.human_owned ?? [];

  return (
    <>
      <TopBar title="Policy" />
      {(saved || error) && (
        <div className={`mx-7 mt-4 rounded-[10px] border px-3.5 py-2.5 text-[13px] ${error ? "border-ai/40 bg-ai-soft text-ai" : "border-human/40 bg-human-soft text-human"}`}>
          {error ? error : "Policy saved."}
        </div>
      )}
      <div className="grid flex-1 grid-cols-1 content-start gap-[18px] overflow-y-auto p-7 lg:grid-cols-[1.1fr_1fr]">
        <PolicyForm threshold={threshold} floor={floor} enforcement={enforcement} humanOwned={humanOwned} />

        <Card className="px-2 pb-1 lg:col-span-2">
          <div className="px-4 pb-1 pt-4">
            <h3 className="font-display text-base font-bold">Per-repository overrides</h3>
            <p className="mt-1 text-[12.5px] text-muted">Repos with rules that differ from the organization defaults.</p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th>Repository</th><th>Threshold</th><th>Enforcement</th><th>Human-owned paths</th><th>Confidence floor</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-[12.5px] [&_tr:last-child_td]:border-none">
              {overrides.map((o) => (
                <tr key={o.repo_id}>
                  <td className="font-medium">{o.repos?.name ?? "—"}</td>
                  <td className="font-mono tabular-nums">{Math.round(o.threshold * 100)}%</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${o.enforcement === "block" ? "bg-ai-soft text-ai" : "bg-human-soft text-human"}`}>
                      {o.enforcement === "block" ? "block merge" : "comment only"}
                    </span>
                  </td>
                  <td className="font-mono tabular-nums">{o.paths} paths</td>
                  <td className="font-mono tabular-nums">{Number(o.floor).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex items-start gap-3 rounded-2xl border border-human/30 bg-human-soft px-4 py-3.5 lg:col-span-2">
          <span className="text-[13px] text-human">
            <b>Signals, not verdicts.</b> Even &ldquo;Block merge&rdquo; is a review gate a maintainer can override — grain measures and surfaces, it never decides who to blame. Defaults ship as comment-only for exactly this reason.
          </span>
        </div>
      </div>
    </>
  );
}
