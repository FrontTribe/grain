"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Three.js loads in the browser only. Without WebGL the hero keeps its plain
// ground: the backdrop is atmosphere, never something the page depends on.
const GrainShader = dynamic(() => import("./GrainShader").then((m) => m.GrainShader), { ssr: false });

export function GrainShaderLazy() {
  const [off, setOff] = useState(false);
  if (off) return null;
  return <GrainShader onUnsupported={() => setOff(true)} />;
}
