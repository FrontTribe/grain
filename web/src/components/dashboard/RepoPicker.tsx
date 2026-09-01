"use client";

import { useActionState, useMemo, useState } from "react";
import { connectGithubRepo, type ConnectState } from "@/app/app/integrations/actions";
import type { GhRepo } from "@/lib/github";

export function RepoPicker({ repos }: { repos: GhRepo[] }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectGithubRepo, {});
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? repos.filter((r) => r.full_name.toLowerCase().includes(s)) : repos;
    return list.slice(0, 60);
  }, [q, repos]);

  return (
    <form action={action}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter your repositories…"
        className="mb-2.5 h-[42px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-brand"
      />
      <div className="max-h-[240px] overflow-y-auto rounded-[10px] border border-line">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-faint">No matching repositories.</div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.full_name}
              type="submit"
              name="repo"
              value={r.full_name}
              disabled={pending}
              className="flex w-full items-center gap-2.5 border-b border-line/60 px-3.5 py-2.5 text-left last:border-none hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="truncate font-mono text-[13px]">{r.full_name}</span>
              {r.private && (
                <span className="flex-none rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">private</span>
              )}
              <span className="ml-auto flex-none font-mono text-[11px] text-brand">{pending ? "…" : "scan →"}</span>
            </button>
          ))
        )}
      </div>

      {state.error && (
        <div className="mt-3 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">{state.error}</div>
      )}
      {state.ok && (
        <div className="mt-3 rounded-[10px] border border-human/40 bg-human-soft px-3.5 py-3 text-[13px] text-human">
          <div className="font-semibold">Connected {state.repo}</div>
          <div className="mt-0.5 text-human/90">
            {state.commits} commits · {state.human}% human · {state.ai}% AI-assisted.{" "}
            <a href="/app/repos" className="underline">View it →</a>
          </div>
        </div>
      )}
    </form>
  );
}
