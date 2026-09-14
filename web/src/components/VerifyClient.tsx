"use client";

import { useState } from "react";
import { verifyBOM, type VerifyResult } from "@/lib/bom";

type Doc = {
  workspace?: { name?: string };
  generated_at?: string;
  scope?: { repositories?: number };
  engine?: { version?: string };
  summary?: { human?: number; ai_assisted?: number; unclassified?: number };
};

const card = "rounded-2xl border border-line bg-surface p-6";

export function VerifyClient() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setResult({ ok: false, reason: "That isn’t valid JSON — paste the full report file." });
      setBusy(false);
      return;
    }
    setResult(await verifyBOM(parsed));
    setBusy(false);
  }

  const doc = result?.ok ? (result.doc as Doc) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <label className="mb-2 block text-[13px] font-medium">Authorship report JSON</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder='Paste the contents of a grain authorship report (the "Download JSON" file) here…'
          className="h-52 w-full resize-y rounded-[10px] border border-line bg-surface-2 p-3.5 font-mono text-[12px] leading-relaxed outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? "Verifying…" : "Verify integrity"}
          </button>
          {text && (
            <button type="button" onClick={() => { setText(""); setResult(null); }} className="text-[13px] text-muted hover:text-ink">
              Clear
            </button>
          )}
        </div>
      </div>

      {result && !result.ok && (
        <div className="rounded-2xl border border-ai/40 bg-ai-soft p-5">
          <div className="flex items-center gap-2 font-display text-[15px] font-bold text-ai">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-5"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
            Not verified
          </div>
          <p className="mt-1.5 text-[13px] text-ai">{result.reason}</p>
          {result.expected && (
            <div className="mt-3 space-y-1 font-mono text-[11px] text-muted">
              <div>claimed: <span className="break-all text-ink">{result.expected}</span></div>
              <div>actual: <span className="break-all text-ink">{result.actual}</span></div>
            </div>
          )}
        </div>
      )}

      {result?.ok && doc && (
        <div className="rounded-2xl border border-human/40 bg-human-soft p-5">
          <div className="flex items-center gap-2 font-display text-[15px] font-bold text-human">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-5"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
            Verified — unaltered since it was generated
          </div>
          <p className="mt-1.5 text-[13px] text-human">
            The digest recomputed from this document matches the one it carries. Its contents have not changed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Workspace" value={doc.workspace?.name ?? "—"} />
            <Stat label="Generated" value={doc.generated_at ? new Date(doc.generated_at).toISOString().slice(0, 10) : "—"} />
            <Stat label="Repositories" value={String(doc.scope?.repositories ?? "—")} />
            <Stat label="Engine" value={doc.engine?.version ?? "—"} />
          </div>
          {doc.summary && (
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-md border border-line-strong">
              <span className="bg-human" style={{ width: `${doc.summary.human ?? 0}%` }} />
              <span className="bg-ai" style={{ width: `${doc.summary.ai_assisted ?? 0}%` }} />
              <span className="bg-line-strong" style={{ width: `${doc.summary.unclassified ?? 0}%` }} />
            </div>
          )}
          <div className="mt-3 font-mono text-[11px] text-muted">
            sha256: <span className="break-all text-ink">{result.digest}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}
