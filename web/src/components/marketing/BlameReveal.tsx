"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export type BlameLine = { ai: boolean; sha: string; n: number; text: string };

// Real `grain blame` output, told in two beats: the file appears, then the
// AI-written lines light up one after another. Storytelling, not decoration:
// this is the product's answer, in the order a reader understands it.
export function BlameReveal({ file, lines, summary }: { file: string; lines: BlameLine[]; summary: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll<HTMLElement>("[data-row]");
      const marks = el.querySelectorAll<HTMLElement>("[data-ai]");
      const foot = el.querySelector<HTMLElement>("[data-foot]");
      if (reduce) {
        gsap.set([rows, foot], { opacity: 1, x: 0 });
        gsap.set(marks, { opacity: 1 });
        return;
      }
      gsap.set(rows, { opacity: 0, x: -6 });
      gsap.set(marks, { opacity: 0 });
      gsap.set(foot, { opacity: 0 });
      gsap
        .timeline({ delay: 0.35, defaults: { ease: "power3.out" } })
        .to(rows, { opacity: 1, x: 0, duration: 0.45, stagger: 0.045 })
        .to(marks, { opacity: 1, duration: 0.3, stagger: 0.07 }, "-=0.1")
        .to(foot, { opacity: 1, duration: 0.5 }, "-=0.2");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-muted">$ grain blame {file}</div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[11.5px] leading-[1.75] text-ink" tabIndex={0}>
        {lines.map((l) => (
          <div key={l.n} data-row className={l.ai ? "text-ai" : undefined}>
            {l.ai ? <span data-ai className="font-semibold">AI </span> : <span>{"   "}</span>}
            <span className="text-faint">{l.sha} </span>
            <span className="text-faint">{String(l.n).padStart(3)}  </span>
            {l.text.replace("\t", "    ")}
          </div>
        ))}
      </pre>
      <div data-foot className="border-t border-line px-4 py-2.5 font-mono text-[12px] text-muted">{summary}</div>
    </div>
  );
}
