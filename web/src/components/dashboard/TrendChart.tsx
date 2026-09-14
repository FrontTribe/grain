// Static SVG area chart: human vs AI authorship over time, with a policy line.
// Human left / AI right ordering + legend + direct labels = CVD-safe (never color alone).
// One month of history draws a single marked point (no line yet); none draws
// the frame and says so, instead of NaN geometry.

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
  const right = W - 20;
  // With one point there is no span to divide by: pin it to the right edge,
  // where the "latest" marker lives anyway.
  const x = (i: number) => (n > 1 ? padX + (i / (n - 1)) * (right - padX) : right - 30);
  const y = (v: number) => bottom - (Math.max(0, Math.min(100, v)) / 100) * (bottom - top);

  const line = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" L ");
  const area = (arr: number[]) => `M ${line(arr)} L ${x(n - 1)} ${bottom} L ${x(0)} ${bottom} Z`;
  const last = n - 1;
  const grid = [0, 45, 90, 135];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height }} role="img" aria-label="Human and AI authorship share by month">
        {grid.map((gy) => (
          <line key={gy} x1={padX} y1={top + gy} x2={right} y2={top + gy} className="stroke-line" />
        ))}
        <line x1={padX} y1={bottom} x2={right} y2={bottom} className="stroke-line-strong" />
        {/* policy threshold */}
        <line x1={padX} y1={y(threshold)} x2={right} y2={y(threshold)} className="stroke-line-strong" strokeWidth={1.4} strokeDasharray="5 5" />
        <text x={right - 2} y={y(threshold) - 5} textAnchor="end" className="fill-faint font-mono" style={{ fontSize: 11 }}>
          {threshold}%
        </text>

        {n > 1 && (
          <>
            <path d={area(human)} className="fill-human" fillOpacity={0.1} />
            <path d={`M ${line(human)}`} fill="none" className="stroke-human" strokeWidth={2.4} />
            <path d={area(ai)} className="fill-ai" fillOpacity={0.12} />
            <path d={`M ${line(ai)}`} fill="none" className="stroke-ai" strokeWidth={2.4} />
          </>
        )}
        {n > 0 && (
          <>
            <circle cx={x(last)} cy={y(human[last])} r={4.5} className="fill-human" />
            <text x={x(last) - 12} y={y(human[last]) - 8} textAnchor="end" className="fill-human font-mono" style={{ fontSize: 12 }}>
              {human[last]}%
            </text>
            <circle cx={x(last)} cy={y(ai[last])} r={4.5} className="fill-ai" />
            <text x={x(last) - 12} y={y(ai[last]) + 16} textAnchor="end" className="fill-ai font-mono" style={{ fontSize: 12 }}>
              {ai[last]}%
            </text>
          </>
        )}
        {n === 0 && (
          <text x={W / 2} y={(top + bottom) / 2} textAnchor="middle" className="fill-faint" style={{ fontSize: 12 }}>
            No scans yet
          </text>
        )}
      </svg>
      <div className={`mt-1 flex px-1.5 font-mono text-[11px] text-faint ${n > 1 ? "justify-between" : "justify-end pr-8"}`}>
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      {n === 1 && <p className="mt-2 text-[12px] text-muted">One month of history so far. The line appears with the second month of scans.</p>}
    </div>
  );
}
