import Link from "next/link";
import { Mark } from "@/components/Mark";
import { VerifyClient } from "@/components/VerifyClient";

export const metadata = {
  title: "Verify authorship report — grain",
  description: "Check that a grain authorship Bill of Materials is unaltered since it was generated.",
};

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[820px] items-center gap-2.5 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-[20px] font-extrabold tracking-tight">
            <Mark size={24} /> grain
          </Link>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.16em] text-faint">integrity check</span>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-10">
        <h1 className="font-display text-[30px] font-extrabold tracking-tight">Verify an authorship report</h1>
        <p className="mb-7 mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
          A grain authorship Bill of Materials carries a SHA-256 digest of its contents and an Ed25519 signature
          over that digest. Paste a report below and this page recomputes the digest and checks the signature in
          your browser — nothing is uploaded — to confirm the human-vs-AI figures are exactly as grain generated
          them, and that grain Cloud generated them.
        </p>

        <VerifyClient />

        <p className="mt-8 text-[12.5px] text-faint">
          Reports come from Settings → Authorship report → Download JSON in any grain workspace.
          Verification runs entirely client-side; the report never leaves your device. The same check works
          offline with the CLI: <code className="font-mono">grain verify --bom report.json</code>. Signing keys are published at{" "}
          <a href="/.well-known/grain-keys.json" className="underline">/.well-known/grain-keys.json</a>; the format is{" "}
          <a href="https://github.com/FrontTribe/grain/blob/main/docs/spec/provenance-v1.md" className="underline">grain provenance v1</a>.
        </p>
      </main>
    </div>
  );
}
