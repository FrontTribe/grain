"use client";

import { useActionState, useState } from "react";
import type { IngestToken } from "@/lib/data";
import {
  createIngestToken,
  revokeIngestToken,
  type CreateTokenState,
} from "@/app/app/settings/tokens/actions";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function IngestTokens({ tokens }: { tokens: IngestToken[] }) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(
    createIngestToken,
    {},
  );
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-base font-bold">Ingest tokens</h3>
      </div>
      <p className="mb-4 text-[12.5px] text-muted">
        Let <code className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[11px]">grain push</code> and the GitHub Action send scans to this workspace. Use as a bearer token against <code className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[11px]">/api/ingest</code>.
      </p>

      {state.token && (
        <div className="mb-4 rounded-[10px] border border-human/40 bg-human-soft p-3.5">
          <div className="mb-2 text-[12.5px] font-medium text-human">
            New token — copy it now, it won&apos;t be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-[12.5px]">
              {state.token}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(state.token!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className={`${btn} bg-ink text-ground`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {state.error && (
        <div className="mb-4 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">
          {state.error}
        </div>
      )}

      <form action={action} className="mb-4 flex items-center gap-2.5">
        <input
          name="name"
          placeholder="Token name (e.g. github-actions)"
          className="h-[42px] flex-1 rounded-[9px] border border-line bg-surface px-3 text-sm outline-none focus:border-brand"
        />
        <button type="submit" disabled={pending} className={`${btn} bg-brand text-surface disabled:opacity-60`}>
          {pending ? "Minting…" : "New token"}
        </button>
      </form>

      {tokens.length === 0 ? (
        <div className="rounded-[9px] border border-dashed border-line py-6 text-center text-[13px] text-faint">
          No tokens yet.
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
              <th>Name</th><th>Prefix</th><th>Last used</th><th></th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
            {tokens.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td className="font-mono text-muted">{t.token_prefix}…</td>
                <td className="text-faint">{ago(t.last_used_at)}</td>
                <td className="text-right">
                  <form action={revokeIngestToken}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="rounded-[7px] px-2.5 py-1 font-mono text-[11.5px] text-ai hover:bg-ai-soft">
                      revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
