"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Terminal } from "./Terminal";

gsap.registerPlugin(ScrollTrigger);

export type StepData = { cmd: string; title: string; body: string; out: string[] };

// Install → commit → verify is a sequence, so it is told as one: the section
// pins while the reader scrolls through the three steps, the list on the left
// tracks the current one and the terminal on the right runs that step's
// session. Below `lg`, and under reduced motion, it degrades to the plain
// stacked list.
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
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
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
          {/* All three sessions share one grid cell so the box keeps the height
              of the tallest; only the active one is visible and animates. */}
          <div className="grid">
            {steps.map((s, i) => (
              <div key={s.cmd} className={`col-start-1 row-start-1 ${i === active ? "" : "invisible"}`} aria-hidden={i !== active}>
                {i === active ? <Terminal lines={s.out} /> : <Terminal lines={s.out} animate={false} />}
              </div>
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
      <Terminal lines={step.out} animate={false} className="min-w-0" />
    </li>
  );
}
