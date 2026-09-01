"use client";

import { useState } from "react";
import type { RepoPolicy } from "@/lib/data";
import { setRepoPolicy, clearRepoPolicy } from "@/app/app/repos/[name]/policy-actions";

const ENF = [
  { k: "comment", l: "Comment" },
  { k: "review", l: "Review" },
  { k: "block", l: "Block" },
];

export function RepoPolicyForm({
  repoId,
  name,
  policy,
  orgPolicy,
}: {
  repoId: string;
  name: string;
  policy: RepoPolicy;
  orgPolicy: { threshold: number; enforcement: string; confidence_floor: number } | null;
}) {
  const hasOverride = !!policy;
  const baseT = policy ? Math.round(policy.threshold * 100) : Math.round((orgPolicy?.threshold ?? 0.4) * 100);
  const baseF = policy ? Math.round(policy.floor * 100) : Math.round((orgPolicy?.confidence_floor ?? 0.5) * 100);
  const baseE = policy?.enforcement ?? orgPolicy?.enforcement ?? "comment";

  const [threshold, setThreshold] = useState(baseT);
  const [floor, setFloor] = useState(baseF);
  const [enforcement, setEnforcement] = useState(baseE);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-bold">Policy</h3>
        <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${hasOverride ? "bg-ai-soft text-ai" : "bg-surface-2 text-muted"}`}>
          {hasOverride ? "override" : "org default"}
        </span>
      </div>

      <form action={setRepoPolicy}>
        <input type="hidden" name="repo_id" value={repoId} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="threshold" value={threshold} />
        <input type="hidden" name="floor" value={floor} />
        <input type="hidden" name="enforcement" value={enforcement} />

        <div className="mb-3">
          <div className="mb-1.5 flex justify-between text-[12.5px] font-medium">
            <span>AI attention threshold</span><span className="font-mono text-ai">{threshold}%</span>
          </div>
          <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-[var(--ai)]" />
        </div>

        <div className="mb-3">
          <div className="mb-1.5 text-[12.5px] font-medium">Enforcement</div>
          <div className="flex gap-1 rounded-[9px] border border-line bg-surface-2 p-1">
            {ENF.map((o) => (
              <button key={o.k} type="button" onClick={() => setEnforcement(o.k)} className={`flex-1 rounded-md py-1.5 text-center text-[12px] ${enforcement === o.k ? "bg-surface font-semibold text-human shadow-sm" : "text-muted hover:text-ink"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-[12.5px] font-medium">
            <span>Confidence floor</span><span className="font-mono text-human">{(floor / 100).toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={100} value={floor} onChange={(e) => setFloor(Number(e.target.value))} className="w-full accent-[var(--human)]" />
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="rounded-[9px] bg-brand px-4 py-2 text-[13px] font-semibold text-surface">Save override</button>
        </div>
      </form>

      {hasOverride && (
        <form action={clearRepoPolicy} className="mt-2">
          <input type="hidden" name="repo_id" value={repoId} />
          <input type="hidden" name="name" value={name} />
          <button type="submit" className="font-mono text-[11.5px] text-faint hover:text-ai">reset to org default</button>
        </form>
      )}
    </div>
  );
}
