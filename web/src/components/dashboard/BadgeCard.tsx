"use client";

import { useState } from "react";
import { enableBadge, disableBadge } from "@/app/app/repos/[name]/badge-actions";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-semibold";

export function BadgeCard({ repoId, name, badgeUrl }: { repoId: string; name: string; badgeUrl: string | null }) {
  const [copied, setCopied] = useState<string>("");
  const markdown = badgeUrl ? `![grain provenance](${badgeUrl})` : "";

  const copy = (text: string, which: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(""), 1400);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-bold">Public badge</h3>
        <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${badgeUrl ? "bg-human-soft text-human" : "bg-surface-2 text-muted"}`}>
          {badgeUrl ? "on" : "off"}
        </span>
      </div>
      <p className="mb-3 text-[12.5px] text-muted">
        A live, always-current provenance badge for your README. The URL exposes only the AI-assisted % — no repo contents.
      </p>

      {badgeUrl ? (
        <>
          <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-line bg-surface-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="grain provenance badge" height={20} />
            <span className="font-mono text-[11px] text-faint">preview</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-[12px]">{markdown}</code>
            <button type="button" onClick={() => copy(markdown, "md")} className={`${btn} bg-ink text-ground`}>
              {copied === "md" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => copy(badgeUrl, "url")} className="font-mono text-[11.5px] text-brand hover:underline">
              {copied === "url" ? "copied url" : "copy URL"}
            </button>
            <form action={disableBadge} className="ml-auto">
              <input type="hidden" name="repo_id" value={repoId} />
              <input type="hidden" name="name" value={name} />
              <button type="submit" className="font-mono text-[11.5px] text-faint hover:text-ai">disable</button>
            </form>
          </div>
        </>
      ) : (
        <form action={enableBadge}>
          <input type="hidden" name="repo_id" value={repoId} />
          <input type="hidden" name="name" value={name} />
          <button type="submit" className={`${btn} bg-brand text-surface`}>Enable public badge</button>
        </form>
      )}
    </div>
  );
}
