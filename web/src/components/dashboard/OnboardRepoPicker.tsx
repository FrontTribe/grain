"use client";

import { useMemo, useState } from "react";
import { onboardScan } from "@/app/app/integrations/actions";
import type { GhRepo } from "@/lib/github";

export function OnboardRepoPicker({ repos, login }: { repos: GhRepo[]; login: string | null }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? repos.filter((r) => r.full_name.toLowerCase().includes(s)) : repos;
    return list.slice(0, 50);
  }, [q, repos]);

  return (
    <form action={onboardScan}>
      <div className="px-[30px] py-[22px]">
        <div className="mb-3.5 flex items-center gap-3">
          <span className="w-[120px] text-[13px] font-medium">Account</span>
          <div className="flex h-11 flex-1 items-center rounded-[10px] border border-line bg-surface px-3.5 text-sm">
            <span className="mr-2.5 size-[22px] rounded-md bg-gradient-to-br from-[#57C6A8] to-[#E28A50]" />
            {login ?? "GitHub"} <span className="ml-auto font-mono text-[11.5px] text-human">connected</span>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-medium">Select repositories to scan</div>
          <div className="font-mono text-[11px] text-faint">up to 10 · {repos.length} available</div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter repositories (e.g. FrontTribe)…"
          className="mb-2 h-[42px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-brand"
        />

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-8 text-center text-[13px] text-faint">
            {repos.length === 0
              ? "No repositories visible to this token. If they belong to an org, grant the OAuth app access to it, then reconnect."
              : "No repositories match your filter."}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto rounded-xl border border-line">
            {filtered.map((r, i) => (
              <label key={r.full_name} className="flex cursor-pointer items-center gap-3 border-b border-line/60 px-4 py-3 last:border-none hover:bg-surface-2">
                <input
                  type="checkbox"
                  name="repo"
                  value={r.full_name}
                  defaultChecked={!q && i < 3}
                  className="size-[17px] accent-[var(--brand)]"
                />
                <span className="truncate text-[13.5px] font-medium">
                  {r.full_name.split("/")[1]} <span className="font-mono font-normal text-faint">{r.full_name.split("/")[0]}/</span>
                </span>
                <span className="ml-auto flex-none rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10.5px] text-muted">
                  {r.private ? "private" : "public"}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-[18px] rounded-[10px] border border-line bg-surface-2 px-4 py-3.5 text-[12.5px] text-ink">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">What grain reads</div>
          <div className="mt-1.5"><span className="font-semibold text-human">Read</span> — commit metadata, authorship trailers, pull requests. Source code stays on GitHub.</div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-line px-[30px] py-[18px]">
        <a href="/app" className="flex h-11 items-center rounded-[10px] border border-line bg-surface px-5 text-[14px] font-semibold text-muted">Skip for now</a>
        <button type="submit" className="flex h-11 items-center rounded-[10px] bg-brand px-5 text-[14px] font-semibold text-white">Scan selected repos</button>
      </div>
    </form>
  );
}
