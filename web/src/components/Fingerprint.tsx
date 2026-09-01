"use client";

import { useEffect, useRef } from "react";

// The signature graphic: a commit history drawn as a barcode of thin bars,
// each colored by authorship. Deterministic (no Math.random), animates in once.
export function Fingerprint({ height = 100, bars = 132 }: { height?: number; bars?: number }) {
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

    const N = bars;
    const data = Array.from({ length: N }, (_, i) => {
      const r = rnd(i + 1);
      const cluster = rnd(Math.floor(i / 6) + 100);
      const p = r * 0.6 + cluster * 0.4;
      const cls = p < 0.73 ? "h" : p < 0.95 ? "a" : "u";
      return { cls, h: 0.42 + rnd(i + 50) * 0.58 };
    });

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
        const b = data[i];
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      obs.disconnect();
    };
  }, [height, bars]);

  return <canvas ref={ref} style={{ display: "block", width: "100%", height }} aria-label="Commit provenance fingerprint" />;
}
