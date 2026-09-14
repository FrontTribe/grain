"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

// The grain of the code, as a material: domain-warped noise drawn as thin
// wood-grain contours in the two authorship colours, drifting slowly and
// bending toward the pointer. A fragment shader on one quad; the whole cost is
// GPU-side. Fades out on the left so the headline sits on clean ground.
// Static frame under reduced motion; the loop pauses when off-screen.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer;   // in the same warped space as p
uniform vec3 uHuman;
uniform vec3 uAI;
uniform vec3 uGround;
uniform float uDark;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 2.4;

  // Pointer: a soft pull on the field, like a finger dragged through sand.
  vec2 d = p - uPointer;
  float pull = exp(-dot(d, d) * 2.2);

  vec2 q = vec2(fbm(p + uTime * 0.035), fbm(p + vec2(5.2, 1.3) - uTime * 0.025));
  vec2 r = p + 1.5 * q + pull * 0.55 * normalize(d + 1e-4);
  float v = fbm(r);

  // Thin contour lines of the warped field: the grain.
  float band = fract(v * 10.0);
  float line = smoothstep(0.0, 0.07, band) * smoothstep(0.19, 0.11, band);

  // Which material each region is: human or AI.
  float split = fbm(r * 0.65 + 3.1);
  vec3 tint = mix(uHuman, uAI, smoothstep(0.44, 0.56, split));

  float strength = line * (0.45 + 0.55 * fbm(p * 1.4 + 7.0));
  float amount = uDark > 0.5 ? 0.6 : 0.34;
  vec3 col = mix(uGround, tint, strength * amount);

  // Keep the left third (headline) and the bottom edge clean.
  float fadeL = smoothstep(0.05, 0.62, uv.x);
  float fadeB = smoothstep(0.0, 0.22, uv.y);
  col = mix(uGround, col, mix(0.18, 1.0, fadeL) * fadeB);
  gl_FragColor = vec4(col, 1.0);
}
`;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function GrainShader({ onUnsupported }: { onUnsupported?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      onUnsupported?.();
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(-10, -10) },
      uHuman: { value: new THREE.Color() },
      uAI: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uDark: { value: 0 },
    };
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
    scene.add(new THREE.Mesh(geo, mat));

    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      uniforms.uHuman.value.set(cssVar("--human"));
      uniforms.uAI.value.set(cssVar("--ai"));
      uniforms.uGround.value.set(cssVar("--ground"));
      const explicit = document.documentElement.getAttribute("data-theme");
      uniforms.uDark.value = explicit === "dark" || (explicit !== "light" && dark.matches) ? 1 : 0;
    };
    const fit = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };

    let raf = 0;
    let visible = true;
    const clock = new THREE.Clock();
    const frame = () => {
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    };

    // Pointer in the shader's p-space (see FRAG), eased so the pull feels physical.
    const target = { x: -10, y: -10 };
    const onPointer = (e: PointerEvent) => {
      if (reduce || coarse) return;
      const r = el.getBoundingClientRect();
      const ux = (e.clientX - r.left) / r.width;
      const uy = 1 - (e.clientY - r.top) / r.height;
      target.x = ux * (r.width / r.height) * 2.4;
      target.y = uy * 2.4;
      gsap.to(uniforms.uPointer.value, { x: target.x, y: target.y, duration: 0.8, ease: "power2.out", overwrite: "auto" });
    };
    const onLeave = () => gsap.to(uniforms.uPointer.value, { x: -10, y: -10, duration: 1.4, ease: "power2.out", overwrite: "auto" });
    const host = el.parentElement ?? el;
    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerleave", onLeave);

    const io = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting;
      if (next && !visible && !reduce) raf = requestAnimationFrame(frame);
      visible = next;
    });
    io.observe(el);
    const onResize = () => {
      fit();
      if (reduce) frame();
    };
    const onScheme = () => {
      applyTheme();
      if (reduce) frame();
    };
    window.addEventListener("resize", onResize);
    dark.addEventListener("change", onScheme);
    const obs = new MutationObserver(onScheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    applyTheme();
    fit();
    frame();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      obs.disconnect();
      dark.removeEventListener("change", onScheme);
      window.removeEventListener("resize", onResize);
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [onUnsupported]);

  return <div ref={wrap} className="absolute inset-0" aria-hidden />;
}
