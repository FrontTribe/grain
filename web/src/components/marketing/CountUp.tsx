"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// A number that counts up once when it scrolls into view. Hierarchy: the eye
// goes to the moving figure, which is the one figure the section is about.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obj = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        v: value,
        duration: 1.4,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
        onUpdate: () => {
          el.textContent = Math.round(obj.v).toLocaleString();
        },
      });
    });
    return () => ctx.revert();
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
    </span>
  );
}
