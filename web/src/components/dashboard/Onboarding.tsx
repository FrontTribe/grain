"use client";

import Link from "next/link";
import { useState } from "react";
import { Fingerprint } from "@/components/Fingerprint";

const INGEST_URL = "https://grain-fronttribe.vercel.app/api/ingest";
const REPO = "https://github.com/FrontTribe/grain";

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
      className="ml-2 flex-none rounded-[7px] border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition hover:text-ink"
    >
      {ok ? "copied" : "copy"}
    </button>
  );
}

function Cmd({ children }: { children: string }) {
  return (
    <div className="flex items-center rounded-[9px] border border-line bg-ink px-3.5 py-2.5">
      <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-[12.5px] leading-relaxed text-ground">
        {children}
      </code>
      <Copy text={children} />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex size-8 flex-none items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[13px] font-semibold text-brand">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="font-display text-[15.5px] font-bold text-ink">{title}</h3>
        <div className="mt-2 flex flex-col gap-2.5 text-[13.5px] text-muted">{children}</div>
      </div>
    </div>
  );
}

export function Onboarding({ workspace }: { workspace: string }) {
  const pushBlock = `export GRAIN_API=${INGEST_URL}\nexport GRAIN_TOKEN=grain_…        # from Settings\ngrain push`;

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto p-7">
      <div className="w-full max-w-[720px]">
        <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-[#1A1712] p-7 text-[#C9C2B3]">
          <div className="mb-4 max-w-[46ch]">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8F8778]">
              {workspace} · empty workspace
            </div>
            <h2 className="mt-2 font-display text-[26px] font-extrabold leading-tight tracking-tight text-[#F1ECE0]">
              Let&apos;s read the grain of your first repo.
            </h2>
            <p className="mt-2 text-[14px] text-[#8F8778]">
              Grain never uploads your code — the CLI scans locally and pushes only the
              provenance report. Three steps and this dashboard fills in.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#2c2820]">
            <Fingerprint height={54} bars={72} />
          </div>
        </div>

        <div className="flex flex-col gap-7 rounded-2xl border border-line bg-surface p-7">
          <Step n={1} title="Install the CLI">
            <p>Homebrew (macOS / Linux):</p>
            <Cmd>brew install FrontTribe/tap/grain</Cmd>
            <p className="text-[12.5px] text-faint">
              Or:{" "}
              <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">
                curl -fsSL https://raw.githubusercontent.com/FrontTribe/grain/main/install.sh | sh
              </code>
            </p>
          </Step>

          <Step n={2} title="Create an ingest token">
            <p>
              A token lets the CLI push scans to this workspace. Mint one and copy it —
              it&apos;s shown only once.
            </p>
            <Link
              href="/app/settings"
              className="inline-flex w-fit items-center gap-2 rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-surface"
            >
              Open Settings → Ingest tokens
            </Link>
          </Step>

          <Step n={3} title="Scan a repo and push">
            <p>From inside any git repository:</p>
            <Cmd>{pushBlock}</Cmd>
            <p className="text-[12.5px] text-faint">
              Prefer CI? Add the{" "}
              <a href={`${REPO}#github-action`} target="_blank" rel="noreferrer" className="text-brand">
                GitHub Action
              </a>{" "}
              with <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">push: true</code> and your token as a secret.
            </p>
          </Step>

          <div className="flex items-center gap-2.5 border-t border-line pt-5 text-[13px] text-muted">
            <span className="size-2 flex-none animate-pulse rounded-full bg-human" />
            Waiting for your first scan — this page updates as soon as one lands.
          </div>
        </div>
      </div>
    </div>
  );
}
