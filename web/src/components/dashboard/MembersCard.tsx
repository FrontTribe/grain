"use client";

import { useActionState, useState } from "react";
import type { Member, Invite } from "@/lib/data";
import { createInvite, revokeInvite, type InviteState } from "@/app/app/settings/members/actions";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";
}
function ago(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function MembersCard({ members, invites, canInvite }: { members: Member[]; invites: Invite[]; canInvite: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold">Members <span className="ml-1 font-mono text-[12px] font-normal text-faint">{members.length}</span></h3>
        {canInvite && (
          <button onClick={() => setOpen((v) => !v)} className={`${btn} border border-line bg-surface text-muted`}>
            {open ? "Close" : "Invite people"}
          </button>
        )}
      </div>

      {canInvite && open && (
        <div className="mb-4 rounded-[10px] border border-line bg-surface-2 p-4">
          <form action={action} className="flex flex-col gap-2.5 sm:flex-row">
            <input name="email" type="email" required placeholder="teammate@company.com" className="h-[42px] flex-1 rounded-[9px] border border-line bg-surface px-3 text-sm outline-none focus:border-brand" />
            <select name="role" defaultValue="member" className="h-[42px] rounded-[9px] border border-line bg-surface px-3 text-sm outline-none focus:border-brand">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={pending} className={`${btn} bg-brand text-surface disabled:opacity-60`}>
              {pending ? "Creating…" : "Create invite"}
            </button>
          </form>
          {state.error && <div className="mt-3 rounded-[9px] border border-ai/40 bg-ai-soft px-3 py-2 text-[12.5px] text-ai">{state.error}</div>}
          {state.link && (
            <div className="mt-3 rounded-[9px] border border-human/40 bg-human-soft p-3">
              <div className="mb-1.5 text-[12.5px] font-medium text-human">Invite link for {state.email} — share it (no email is sent):</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[7px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px]">{state.link}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(state.link!); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
                  className={`${btn} bg-ink px-3 py-1.5 text-ground`}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
            <th>Person</th><th>Email</th><th>Role</th><th>Joined</th>
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
          {members.map((m) => (
            <tr key={m.user_id}>
              <td><span className="flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-semibold text-muted">{initials(m.name)}</span>{m.name}</span></td>
              <td className="text-muted">{m.email}</td>
              <td><span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${m.role === "owner" ? "bg-brand/15 text-brand" : m.role === "admin" ? "bg-human-soft text-human" : "bg-surface-2 text-muted"}`}>{m.role}</span></td>
              <td className="text-faint">{ago(m.joined_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {invites.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Pending invites</div>
          <div className="flex flex-col gap-1.5">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2.5 rounded-[9px] border border-dashed border-line px-3 py-2">
                <span className="text-[13px]">{i.email}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-muted">{i.role}</span>
                {canInvite && (
                  <form action={revokeInvite} className="ml-auto">
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="rounded-[7px] px-2 py-1 font-mono text-[11.5px] text-ai hover:bg-ai-soft">revoke</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
