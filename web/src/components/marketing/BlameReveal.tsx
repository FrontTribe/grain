"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export type BlameLine = { ai: boolean; sha: string; n: number; text: string };

// Real `grain blame` output as a code view, told in two beats: the file
// appears, then the AI-written rows tint and get their tag one after another.
// Storytelling, not decoration: this is the product's answer, in the order a
// reader understands it.
export function BlameReveal({ file, lines, summary }: { file: string; lines: BlameLine[]; summary: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll<HTMLElement>("[data-row]");
      const tints = el.querySelectorAll<HTMLElement>("[data-tint]");
      const tags = el.querySelectorAll<HTMLElement>("[data-tag]");
      const foot = el.querySelector<HTMLElement>("[data-foot]");
      if (reduce) {
        gsap.set([rows, tints, tags, foot], { opacity: 1, x: 0 });
        return;
      }
      gsap.set(rows, { opacity: 0, x: -6 });
      gsap.set([tints, tags], { opacity: 0 });
      gsap.set(foot, { opacity: 0 });
      gsap
        .timeline({ delay: 0.35, defaults: { ease: "power3.out" } })
        .to(rows, { opacity: 1, x: 0, duration: 0.45, stagger: 0.04 })
        .to(tints, { opacity: 1, duration: 0.35, stagger: 0.09 }, "-=0.1")
        .to(tags, { opacity: 1, duration: 0.25, stagger: 0.09 }, "<0.05")
        .to(foot, { opacity: 1, duration: 0.5 }, "-=0.2");
    }, el);
    return () => ctx.revert();
  }, []);

  const gutter = String(lines[lines.length - 1]?.n ?? 0).length;

  return (
    <div ref={root} className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 font-mono text-[12px]">
        <span className="truncate text-muted">
          <span className="text-human">$</span> grain blame <span className="text-ink">{file}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
          <i className="size-2 rounded-[2px] bg-ai" aria-hidden /> AI-written
        </span>
      </div>
      <div className="py-2 font-mono text-[12.5px] leading-[1.9] text-ink">
        {lines.map((l) => (
          <div key={l.n} data-row className="relative flex items-baseline gap-3 px-4">
            {l.ai && <span data-tint className="absolute inset-0 bg-ai-soft" aria-hidden />}
            <span className="relative w-[3ch] shrink-0 select-none text-right text-[11px] text-faint" style={{ width: `${gutter}ch` }}>
              {l.n}
            </span>
            <span className="relative whitespace-pre">{l.text.replace(/\t/g, "  ")}</span>
            {l.ai && (
              <span data-tag className="relative ml-auto shrink-0 pl-3 text-[10.5px] font-semibold tracking-wide text-ai">
                AI
              </span>
            )}
          </div>
        ))}
      </div>
      <div data-foot className="border-t border-line px-4 py-2.5 font-mono text-[12px] text-muted">
        {summary}
      </div>
    </div>
  );
}
