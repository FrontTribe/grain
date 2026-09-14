"use client";

import { useState } from "react";

// One install command at a time, picked by platform, with a copy button.
// Discrete state only (which tab, whether the copy just happened).
const OPTIONS = [
  { id: "sh", label: "macOS / Linux", cmd: "curl -fsSL https://raw.githubusercontent.com/FrontTribe/grain/main/install.sh | sh" },
  { id: "brew", label: "Homebrew", cmd: "brew install FrontTribe/tap/grain" },
  { id: "npx", label: "npm", cmd: "npx grain scan" },
  { id: "go", label: "Go", cmd: "go install github.com/FrontTribe/grain/cmd/grain@latest" },
  { id: "scoop", label: "Windows", cmd: "scoop bucket add fronttribe https://github.com/FrontTribe/scoop-bucket && scoop install grain" },
] as const;

export function InstallPicker() {
  const [id, setId] = useState<(typeof OPTIONS)[number]["id"]>("sh");
  const current = OPTIONS.find((o) => o.id === id) ?? OPTIONS[0];
  return (
    <div>
      <div role="tablist" aria-label="Install method" className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => {
          const on = o.id === id;
          return (
            <button
              key={o.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setId(o.id)}
              className={`press rounded-[10px] px-3 py-1.5 text-[13px] font-medium ${on ? "bg-ink text-ground" : "border border-line text-muted hover:border-ink hover:text-ink"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <CopyCommand cmd={current.cmd} className="mt-3" />
      {id !== "npx" && <CopyCommand cmd="grain scan" className="mt-2" />}
    </div>
  );
}

export function CopyCommand({ cmd, className = "" }: { cmd: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[10px] border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] text-ink">
        <span className="text-human">$</span> {cmd}
      </code>
      <button type="button" onClick={copy} className="press shrink-0 rounded-[10px] border border-line-strong px-3 text-[13px] font-medium text-ink hover:border-ink" aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
