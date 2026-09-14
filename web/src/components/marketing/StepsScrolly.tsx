"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type StepData = { cmd: string; title: string; body: string; out: string };

// Install → commit → verify is a sequence, so it is told as one: the section
// pins while the reader scrolls through the three steps, the list on the left
// tracks the current one and the transcript on the right crossfades. Below
// `lg`, and under reduced motion, it degrades to the plain stacked list.
export function StepsScrolly({ steps }: { steps: StepData[] }) {
  const spacer = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);

  // 1) Decide the mode from the media query (this also flips back on resize).
  //    The trigger is killed *before* React swaps layouts, so GSAP's inline
  //    styles are reverted while the node still exists.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const apply = () => {
      if (!mq.matches) {
        trigger.current?.kill();
        trigger.current = null;
      }
      setPinned(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 2) Once the pinned layout is on screen, drive it with ScrollTrigger. React
  //    owns the spacer element, so GSAP never restructures the DOM under it.
  useEffect(() => {
    const el = wrap.current;
    const sp = spacer.current;
    if (!pinned || !el || !sp) return;
    const n = steps.length;
    const st = ScrollTrigger.create({
      trigger: el,
      pin: el,
      pinSpacer: sp,
      start: "top top",
      end: () => `+=${window.innerHeight * (n - 1) * 0.9}`,
      scrub: true,
      onUpdate: (self) => {
        // Discrete step index: React state only changes at the boundaries.
        const idx = Math.min(n - 1, Math.floor(self.progress * n + 1e-6));
        setActive((cur) => (cur === idx ? cur : idx));
      },
    });
    trigger.current = st;
    return () => {
      st.kill();
      if (trigger.current === st) trigger.current = null;
    };
  }, [pinned, steps.length]);

  if (!pinned) {
    return (
      <ol className="mt-12 flex flex-col">
        {steps.map((s, i) => (
          <StepRow key={s.cmd} step={s} last={i === steps.length - 1} />
        ))}
      </ol>
    );
  }

  return (
    <div ref={spacer}>
    <div ref={wrap} className="mt-8 flex min-h-[100dvh] flex-col justify-center">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="flex flex-col">
          {steps.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.cmd} className={`border-b border-line py-6 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-40"}`}>
                <code className="inline-block rounded-[8px] bg-surface-2 px-2.5 py-1 font-mono text-[13.5px] font-semibold text-ink">
                  <span className="text-human">$</span> {s.cmd}
                </code>
                <h3 className="mt-3 font-display text-[22px] font-bold tracking-tight">{s.title}</h3>
                <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <p className="min-h-0 overflow-hidden text-[15px] leading-relaxed text-muted">
                    <span className="block pt-2">{s.body}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="relative min-h-[300px]">
          {steps.map((s, i) => (
            <pre
              key={s.cmd}
              aria-hidden={i !== active}
              className={`absolute inset-0 overflow-x-auto rounded-[14px] border border-line bg-surface px-5 py-4 font-mono text-[12.5px] leading-[1.7] text-ink transition-all duration-500 ease-out ${
                i === active ? "translate-y-0 opacity-100" : i < active ? "-translate-y-3 opacity-0" : "translate-y-3 opacity-0"
              }`}
            >
              {s.out}
            </pre>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

function StepRow({ step, last }: { step: StepData; last: boolean }) {
  return (
    <li className={`reveal grid gap-5 py-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 ${last ? "" : "border-b border-line"}`}>
      <div>
        <code className="inline-block rounded-[8px] bg-surface-2 px-2.5 py-1 font-mono text-[13.5px] font-semibold text-ink">
          <span className="text-human">$</span> {step.cmd}
        </code>
        <h3 className="mt-3.5 font-display text-[22px] font-bold tracking-tight">{step.title}</h3>
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-muted">{step.body}</p>
      </div>
      <pre className="min-w-0 overflow-x-auto rounded-[14px] border border-line bg-surface px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-ink" tabIndex={0}>{step.out}</pre>
    </li>
  );
}
