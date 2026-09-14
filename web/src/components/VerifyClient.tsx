"use client";

import { useState } from "react";
import { verifyBOM, type VerifyResult, type SignatureCheck } from "@/lib/bom";

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

      {result?.ok && <SignatureCard sig={result.signature} />}
    </div>
  );
}

// The signature verdict sits under the integrity one: a report can be
// unaltered yet unsigned (older exports), or signed by a key nobody vouches for.
function SignatureCard({ sig }: { sig: SignatureCheck | null }) {
  if (!sig) {
    return (
      <div className={card}>
        <div className="font-display text-[14px] font-bold text-muted">Not signed</div>
        <p className="mt-1 text-[13px] text-muted">
          This report carries no signature — it predates signing, or was generated by a server without a key. The digest above still proves it wasn’t altered; it can’t prove who generated it.
        </p>
      </div>
    );
  }
  if (sig.status === "unsupported") {
    return (
      <div className={card}>
        <div className="font-display text-[14px] font-bold text-muted">Signed — this browser can’t verify Ed25519</div>
        <p className="mt-1 text-[13px] text-muted">
          Key <code className="font-mono text-ink">{sig.key_id}</code>. Verify it with the CLI instead: <code className="font-mono text-ink">grain verify --bom report.json</code>
        </p>
      </div>
    );
  }
  if (sig.status === "invalid") {
    return (
      <div className="rounded-2xl border border-ai/40 bg-ai-soft p-5">
        <div className="font-display text-[14px] font-bold text-ai">Signature does not verify</div>
        <p className="mt-1 text-[13px] text-ai">
          The Ed25519 signature doesn’t match this report’s digest. Treat the report as unsigned — the signature block was altered or copied from another report.
        </p>
      </div>
    );
  }
  const publisher =
    sig.published === true ? "issued by getgrain.dev" : sig.published === false ? "key not published by getgrain.dev" : "publisher check unavailable";
  const tone = sig.published === false ? "text-ai" : "text-human";
  return (
    <div className="rounded-2xl border border-human/40 bg-human-soft p-5">
      <div className={`flex items-center gap-2 font-display text-[14px] font-bold ${tone}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-4.5"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="m9.5 12 2 2 3.5-4" /></svg>
        Signed — {publisher}
      </div>
      <p className="mt-1 text-[13px] text-human">
        Ed25519 signature over the digest verifies with key <code className="font-mono">{sig.key_id}</code>.
        {sig.published === true && " That key is listed at getgrain.dev/.well-known/grain-keys.json, so this report was generated by grain Cloud, not assembled by hand."}
        {sig.published === false && " That key is not one getgrain.dev publishes — whoever signed it, it wasn’t grain Cloud."}
      </p>
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
