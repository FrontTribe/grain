"use client";

import { useActionState } from "react";
import { connectGithubRepo, type ConnectState } from "@/app/app/integrations/actions";

const gitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" />
  </svg>
);

export function ConnectRepo({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectGithubRepo, {});

  return (
    <div>
      <form action={action} className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex flex-1 items-center rounded-[10px] border border-line bg-surface px-3 focus-within:border-brand">
          <span className="font-mono text-[13px] text-faint">github.com/</span>
          <input
            name="repo"
            required
            placeholder="owner/repo"
            className="h-[46px] w-full bg-transparent px-1 text-[14px] outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-ink px-5 text-[14px] font-semibold text-ground disabled:opacity-60"
        >
          {gitIcon} {pending ? "Scanning…" : "Connect & scan"}
        </button>
      </form>

      {state.error && (
        <div className="mt-3 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mt-3 rounded-[10px] border border-human/40 bg-human-soft px-3.5 py-3 text-[13px] text-human">
          <div className="font-semibold">Connected {state.repo}</div>
          <div className="mt-0.5 text-human/90">
            {state.commits} commits scanned · {state.human}% human · {state.ai}% AI-assisted.{" "}
            <a href="/app/repos" className="underline">View it →</a>
          </div>
        </div>
      )}
      {!compact && (
        <p className="mt-3 text-[12px] text-faint">
          Public repos scan instantly. Declared signals only (Co-Authored-By, bot commits) —
          for line-level directories, push from the CLI. Private repos: connect a token (soon).
        </p>
      )}
    </div>
  );
}
