import { TopBar, Card } from "@/components/dashboard/ui";
import { policy } from "@/lib/mock";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

function Slider({ pct, tone }: { pct: number; tone: "ai" | "human" }) {
  const color = tone === "ai" ? "var(--ai)" : "var(--human)";
  return (
    <div className="relative h-2 rounded bg-surface-2">
      <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%`, background: color }} />
      <span
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface"
        style={{ left: `${pct}%`, borderColor: color }}
      />
    </div>
  );
}

export default function Policy() {
  return (
    <>
      <TopBar
        title="Policy"
        right={
          <>
            <span className={`${btn} border border-line bg-surface text-muted`}>Reset</span>
            <span className={`${btn} bg-brand text-surface`}>Save policy</span>
          </>
        }
      />
      <div className="grid flex-1 grid-cols-1 content-start gap-[18px] overflow-y-auto p-7 lg:grid-cols-[1.1fr_1fr]">
        {/* org defaults */}
        <Card className="p-6">
          <h3 className="font-display text-base font-bold">Organization defaults</h3>
          <p className="mb-4 mt-1 text-[12.5px] text-muted">Applied to every repo unless overridden. Signals, never hard blocks by default.</p>

          <div className="mb-5">
            <div className="mb-2 flex justify-between text-[13px] font-medium">
              <span>AI-assisted attention threshold</span>
              <span className="font-mono text-ai">{policy.threshold}%</span>
            </div>
            <Slider pct={policy.threshold} tone="ai" />
          </div>

          <div className="mb-5">
            <div className="mb-2 text-[13px] font-medium">Enforcement on a flagged PR</div>
            <div className="flex gap-1 rounded-[9px] border border-line bg-surface-2 p-1">
              {[
                { k: "comment", l: "Comment only" },
                { k: "review", l: "Request review" },
                { k: "block", l: "Block merge" },
              ].map((o) => (
                <span
                  key={o.k}
                  className={`flex-1 rounded-md p-2 text-center text-[12.5px] ${
                    policy.enforcement === o.k ? "bg-surface font-semibold text-human shadow-sm" : "text-muted"
                  }`}
                >
                  {o.l}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-[13px] font-medium">
              <span>Inference confidence floor</span>
              <span className="font-mono text-human">{policy.confidence.toFixed(2)}</span>
            </div>
            <Slider pct={policy.confidence * 100} tone="human" />
          </div>
        </Card>

        {/* human-owned */}
        <Card className="p-6">
          <h3 className="font-display text-base font-bold">Human-owned paths</h3>
          <p className="mb-4 mt-1 text-[12.5px] text-muted">AI-assisted changes to these paths raise an attention flag.</p>
          <div className="flex flex-col gap-2">
            {policy.humanOwned.map((p) => (
              <div key={p} className="flex items-center gap-2.5 rounded-[9px] border border-line bg-surface-2 px-3 py-2.5">
                <code className="font-mono text-[12.5px]">{p}</code>
                <span className="ml-auto cursor-pointer font-mono text-[12px] text-faint">remove</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value="src/crypto/**"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12.5px]"
            />
            <button className="rounded-lg bg-ink px-4 text-[13px] text-ground">Add path</button>
          </div>
        </Card>

        {/* overrides */}
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
              {policy.overrides.map((o) => (
                <tr key={o.repo}>
                  <td className="font-medium">{o.repo}</td>
                  <td className="font-mono tabular-nums">{o.threshold}%</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${o.enforcement === "block" ? "bg-ai-soft text-ai" : "bg-human-soft text-human"}`}>
                      {o.enforcement === "block" ? "block merge" : "comment only"}
                    </span>
                  </td>
                  <td className="font-mono tabular-nums">{o.paths} paths</td>
                  <td className="font-mono tabular-nums">{o.floor.toFixed(2)}</td>
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
