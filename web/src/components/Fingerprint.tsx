"use client";

import { useEffect, useRef } from "react";

export type FingerprintBar = { c: "h" | "a" | "u"; w: number };

// The signature graphic: a commit history drawn as a barcode of thin bars,
// each colored by authorship, height by lines changed. Pass `data` to draw
// real commits (the landing page passes grain's own scan); without it the
// pattern is deterministic (no Math.random). Animates in once.
export function Fingerprint({ height = 100, bars = 132, data }: { height?: number; bars?: number; data?: FingerprintBar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = (v: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const rnd = (n: number) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    let series: { cls: "h" | "a" | "u"; h: number }[];
    if (data && data.length) {
      // Real commits: bar height on a log scale of lines changed so one huge
      // commit doesn't flatten the rest.
      const max = Math.log1p(Math.max(...data.map((d) => d.w), 1));
      series = data.map((d) => ({ cls: d.c, h: 0.25 + 0.75 * (Math.log1p(d.w) / max) }));
    } else {
      series = Array.from({ length: bars }, (_, i) => {
        const r = rnd(i + 1);
        const cluster = rnd(Math.floor(i / 6) + 100);
        const p = r * 0.6 + cluster * 0.4;
        const cls = p < 0.73 ? "h" : p < 0.95 ? "a" : "u";
        return { cls, h: 0.42 + rnd(i + 50) * 0.58 };
      });
    }
    const N = series.length;

    let raf = 0;
    const fit = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 1040;
      canvas.width = w * ratio;
      canvas.height = height * ratio;
    };
    const draw = (prog: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const human = css("--human");
      const ai = css("--ai");
      const unc = css("--line-strong");
      const scale = W / (canvas.clientWidth || 1040);
      const gap = 2 * scale;
      const bw = (W - gap * (N - 1)) / N;
      const shown = Math.floor(N * prog);
      for (let i = 0; i < N; i++) {
        const b = series[i];
        ctx.globalAlpha = i < shown ? 1 : i === shown ? N * prog - shown : 0;
        ctx.fillStyle = b.cls === "h" ? human : b.cls === "a" ? ai : unc;
        const bh = H * b.h;
        const x = i * (bw + gap);
        const y = (H - bh) / 2;
        const rr = Math.min(bw / 2, 3);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, rr);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    fit();
    if (reduce) {
      draw(1);
    } else {
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const t = Math.min((ts - start) / 950, 1);
        draw(1 - Math.pow(1 - t, 3));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    const onResize = () => {
      fit();
      draw(1);
    };
    window.addEventListener("resize", onResize);
    const obs = new MutationObserver(() => draw(1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => draw(1);
    mq.addEventListener("change", onScheme);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onScheme);
      obs.disconnect();
    };
  }, [height, bars, data]);

  return <canvas ref={ref} style={{ display: "block", width: "100%", height }} aria-label="Commit history drawn as bars: green human-written, orange AI-written" />;
}
