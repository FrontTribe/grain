"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// A terminal session, rendered from real transcript lines. Prompt lines start
// with "$ ", checkmarks and "key: value" lines get their own colour, and the
// lines type in with a short stagger when the session mounts (feedback: the
// command just ran). One blinking cursor, static under reduced motion.
export function Terminal({ lines, animate = true, className = "" }: { lines: string[]; animate?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll<HTMLElement>("[data-line]");
      gsap.set(rows, { opacity: 0, y: 3 });
      gsap.to(rows, { opacity: 1, y: 0, duration: 0.28, stagger: 0.045, ease: "power2.out", delay: 0.12 });
    }, el);
    return () => ctx.revert();
  }, [animate, lines]);

  return (
    <div ref={root} className={`term overflow-x-auto rounded-[14px] px-5 py-4 font-mono text-[12px] leading-[1.75] ${className}`} tabIndex={0}>
      {lines.map((line, i) => (
        <div key={i} data-line className="whitespace-pre">
          {renderLine(line)}
        </div>
      ))}
      <div data-line aria-hidden>
        <span className="term-prompt">$ </span>
        <span className="term-cursor" />
      </div>
    </div>
  );
}

function renderLine(line: string): React.ReactNode {
  if (line.startsWith("$ ")) {
    return (
      <>
        <span className="term-prompt">$ </span>
        <span className="term-cmd">{line.slice(2)}</span>
      </>
    );
  }
  if (line.trimStart().startsWith("✓")) return <span className="term-ok">{line}</span>;
  // "  Key: value" (notes, verify counts) and JSON `"key": value` lines.
  const m = line.match(/^(\s*"?)([A-Za-z][\w-]*)("?):(\s.*|$)/);
  if (m) {
    return (
      <>
        <span className="term-muted">{m[1]}{m[2]}{m[3]}:</span>
        <span>{m[4]}</span>
      </>
    );
  }
  if (line.trim() === "") return " ";
  return <span className={/^\s+\S/.test(line) ? "" : "term-muted"}>{line}</span>;
}
