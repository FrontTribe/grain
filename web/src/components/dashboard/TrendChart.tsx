// Static SVG area chart: human vs AI authorship over time, with a policy line.
// Human left / AI right ordering + legend + direct labels = CVD-safe (never color alone).

export function TrendChart({
  months,
  human,
  ai,
  threshold,
  height = 220,
}: {
  months: string[];
  human: number[];
  ai: number[];
  threshold: number;
  height?: number;
}) {
  const W = 760;
  const H = 220;
  const padX = 40;
  const top = 20;
  const bottom = 200;
  const n = months.length;
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2 + 20);
  const y = (v: number) => bottom - (v / 100) * (bottom - top);

  const line = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" L ");
  const area = (arr: number[]) => `M ${line(arr)} L ${x(n - 1)} ${bottom} L ${x(0)} ${bottom} Z`;

  const grid = [0, 45, 90, 135];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height }}>
        {grid.map((gy) => (
          <line key={gy} x1={padX} y1={top + gy} x2={W - 20} y2={top + gy} className="stroke-line" />
        ))}
        <line x1={padX} y1={bottom} x2={W - 20} y2={bottom} className="stroke-line-strong" />
        {/* policy threshold */}
        <line x1={padX} y1={y(threshold)} x2={W - 20} y2={y(threshold)} className="stroke-line-strong" strokeWidth={1.4} strokeDasharray="5 5" />
        <text x={W - 22} y={y(threshold) - 5} textAnchor="end" className="fill-faint font-mono" style={{ fontSize: 11 }}>
          {threshold}%
        </text>

        <path d={area(human)} className="fill-human" fillOpacity={0.1} />
        <path d={`M ${line(human)}`} fill="none" className="stroke-human" strokeWidth={2.4} />
        <circle cx={x(n - 1)} cy={y(human[n - 1])} r={4.5} className="fill-human" />
        <text x={x(n - 1) - 12} y={y(human[n - 1]) - 8} textAnchor="end" className="fill-human font-mono" style={{ fontSize: 12 }}>
          {human[n - 1]}%
        </text>

        <path d={area(ai)} className="fill-ai" fillOpacity={0.12} />
        <path d={`M ${line(ai)}`} fill="none" className="stroke-ai" strokeWidth={2.4} />
        <circle cx={x(n - 1)} cy={y(ai[n - 1])} r={4.5} className="fill-ai" />
        <text x={x(n - 1) - 12} y={y(ai[n - 1]) + 16} textAnchor="end" className="fill-ai font-mono" style={{ fontSize: 12 }}>
          {ai[n - 1]}%
        </text>
      </svg>
      <div className="mt-1 flex justify-between px-1.5 font-mono text-[11px] text-faint">
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}
