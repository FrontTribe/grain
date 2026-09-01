import React from "react";

export function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex h-[62px] flex-none items-center gap-3 border-b border-line bg-surface px-7">
      <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
      <span className="flex-1" />
      {right}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function ProvBar({ human, ai, unc = 0, h = 8 }: { human: number; ai: number; unc?: number; h?: number }) {
  return (
    <div className="flex w-full gap-0.5 overflow-hidden rounded" style={{ height: h }}>
      <span className="h-full rounded-sm bg-human" style={{ width: `${human}%` }} />
      <span className="h-full rounded-sm bg-ai" style={{ width: `${ai}%` }} />
      {unc > 0 && <span className="h-full rounded-sm bg-line-strong" style={{ width: `${unc}%` }} />}
    </div>
  );
}

export function MiniBar({ human, ai, width = 130 }: { human: number; ai: number; width?: number }) {
  const total = human + ai || 1;
  return (
    <span className="inline-flex h-2 gap-0.5 overflow-hidden rounded align-middle" style={{ width }}>
      <span className="h-full rounded-sm bg-human" style={{ width: `${(human / total) * 100}%` }} />
      <span className="h-full rounded-sm bg-ai" style={{ width: `${(ai / total) * 100}%` }} />
    </span>
  );
}

export function Spark({ series, w = 70, h = 22, up }: { series: number[]; w?: number; h?: number; up?: boolean }) {
  const max = 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - 3 - (v / max) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="align-middle">
      <polyline points={pts} fill="none" strokeWidth={1.8} className={up ? "stroke-ai" : "stroke-human"} />
    </svg>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "attention"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${
        tone === "attention" ? "bg-ai-soft text-ai" : "bg-human-soft text-human"
      }`}
    >
      {children}
    </span>
  );
}

export function Kpi({ label, value, valueClass = "", children }: { label: string; value: string; valueClass?: string; children?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`mt-2 font-display text-[34px] font-bold leading-none tracking-tight ${valueClass}`}>{value}</div>
      {children && <div className="mt-2.5 text-[12.5px] text-muted">{children}</div>}
    </Card>
  );
}
