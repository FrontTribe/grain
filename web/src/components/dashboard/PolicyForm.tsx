"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/ui";
import { updateOrgPolicy } from "@/app/app/policy/actions";

const ENFORCEMENTS = [
  { k: "comment", l: "Comment only" },
  { k: "review", l: "Request review" },
  { k: "block", l: "Block merge" },
];

export function PolicyForm({
  threshold: t0,
  floor: f0,
  enforcement: e0,
  humanOwned: h0,
}: {
  threshold: number; // 0-100
  floor: number; // 0-1
  enforcement: string;
  humanOwned: string[];
}) {
  const [threshold, setThreshold] = useState(t0);
  const [floor, setFloor] = useState(Math.round(f0 * 100));
  const [enforcement, setEnforcement] = useState(e0);
  const [paths, setPaths] = useState<string[]>(h0);
  const [draft, setDraft] = useState("");

  const addPath = () => {
    const p = draft.trim();
    if (p && !paths.includes(p)) setPaths([...paths, p]);
    setDraft("");
  };

  return (
    <form action={updateOrgPolicy} className="contents">
      <input type="hidden" name="threshold" value={threshold} />
      <input type="hidden" name="floor" value={floor} />
      <input type="hidden" name="enforcement" value={enforcement} />
      {paths.map((p) => (
        <input key={p} type="hidden" name="path" value={p} />
      ))}

      <Card className="p-6">
        <h3 className="font-display text-base font-bold">Organization defaults</h3>
        <p className="mb-4 mt-1 text-[12.5px] text-muted">Applied to every repo unless overridden. Signals, never hard blocks by default.</p>

        <div className="mb-5">
          <div className="mb-2 flex justify-between text-[13px] font-medium">
            <span>AI-assisted attention threshold</span><span className="font-mono text-ai">{threshold}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-[var(--ai)]"
          />
        </div>

        <div className="mb-5">
          <div className="mb-2 text-[13px] font-medium">Enforcement on a flagged PR</div>
          <div className="flex gap-1 rounded-[9px] border border-line bg-surface-2 p-1">
            {ENFORCEMENTS.map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setEnforcement(o.k)}
                className={`flex-1 rounded-md p-2 text-center text-[12.5px] ${enforcement === o.k ? "bg-surface font-semibold text-human shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-[13px] font-medium">
            <span>Inference confidence floor</span><span className="font-mono text-human">{(floor / 100).toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={100} value={floor}
            onChange={(e) => setFloor(Number(e.target.value))}
            className="w-full accent-[var(--human)]"
          />
        </div>
      </Card>

      <Card className="flex flex-col p-6">
        <h3 className="font-display text-base font-bold">Human-owned paths</h3>
        <p className="mb-4 mt-1 text-[12.5px] text-muted">AI-assisted changes to these paths raise an attention flag.</p>
        <div className="flex flex-col gap-2">
          {paths.length === 0 && <div className="rounded-[9px] border border-dashed border-line py-4 text-center text-[12.5px] text-faint">No human-owned paths yet.</div>}
          {paths.map((p) => (
            <div key={p} className="flex items-center gap-2.5 rounded-[9px] border border-line bg-surface-2 px-3 py-2.5">
              <code className="font-mono text-[12.5px]">{p}</code>
              <button type="button" onClick={() => setPaths(paths.filter((x) => x !== p))} className="ml-auto cursor-pointer font-mono text-[12px] text-faint hover:text-ai">remove</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPath(); } }}
            placeholder="src/crypto/**"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12.5px] outline-none focus:border-brand"
          />
          <button type="button" onClick={addPath} className="rounded-lg bg-ink px-4 text-[13px] text-ground">Add path</button>
        </div>
        <div className="mt-auto flex justify-end pt-5">
          <button type="submit" className="inline-flex items-center gap-2 rounded-[9px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-surface">Save policy</button>
        </div>
      </Card>
    </form>
  );
}
