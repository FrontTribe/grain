"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// A card that tilts a few degrees toward the pointer, like a sheet you'd
// pick up to read. Feedback for the one object in the hero worth touching.
// Pointer-driven values go through GSAP, never React state. Off for touch
// and reduced motion.
export function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3.out" });
    const lift = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    gsap.set(el, { transformPerspective: 1200, transformOrigin: "center" });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      rx(-ny * 6);
      ry(nx * 8);
      lift(-3);
    };
    const onLeave = () => {
      rx(0);
      ry(0);
      lift(0);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}
