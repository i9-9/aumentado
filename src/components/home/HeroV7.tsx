"use client";

import { VedicMonolithScene } from "@/components/monolith/VedicMonolithScene";
import type { EnvMode, TexMode } from "@/lib/vedicMonolith";
import { Canvas } from "@react-three/fiber";
import { useState, type ReactNode } from "react";
import * as THREE from "three";

function CtrlBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-white/35 bg-white text-black"
          : "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function HeroV7() {
  const [texMode, setTexMode] = useState<TexMode>("root");
  const [cellSize, setCellSize] = useState(12);
  const [animOn, setAnimOn] = useState(true);
  const [floatOn, setFloatOn] = useState(true);
  const [envMode, setEnvMode] = useState<EnvMode>("dark");

  return (
    <section className="relative h-[100dvh] overflow-hidden bg-[#080810]">
      <Canvas
        shadows
        camera={{ fov: 45, position: [0, 1.5, 7], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <VedicMonolithScene
          texMode={texMode}
          cellSize={cellSize}
          animOn={animOn}
          floatOn={floatOn}
          envMode={envMode}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute right-6 bottom-8 flex max-w-[min(100%,20rem)] flex-col gap-3 sm:right-10 sm:bottom-10">
          <div className="flex flex-wrap gap-1.5">
            <CtrlBtn active={texMode === "root"} onClick={() => setTexMode("root")}>
              Raíces
            </CtrlBtn>
            <CtrlBtn active={texMode === "mono"} onClick={() => setTexMode("mono")}>
              Mono
            </CtrlBtn>
            <CtrlBtn active={texMode === "wave"} onClick={() => setTexMode("wave")}>
              Onda
            </CtrlBtn>
          </div>

          <input
            type="range"
            min={4}
            max={32}
            step={1}
            value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
            className="pointer-events-auto h-1 w-full accent-white/50"
            aria-label="Tamaño de celda"
          />

          <div className="flex flex-wrap gap-1.5">
            <CtrlBtn active={animOn} onClick={() => setAnimOn((v) => !v)}>
              {animOn ? "On" : "Off"}
            </CtrlBtn>
            <CtrlBtn active={floatOn} onClick={() => setFloatOn((v) => !v)}>
              Flotar
            </CtrlBtn>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CtrlBtn active={envMode === "dark"} onClick={() => setEnvMode("dark")}>
              Noche
            </CtrlBtn>
            <CtrlBtn active={envMode === "fog"} onClick={() => setEnvMode("fog")}>
              Niebla
            </CtrlBtn>
            <CtrlBtn active={envMode === "void"} onClick={() => setEnvMode("void")}>
              Void
            </CtrlBtn>
          </div>
        </div>
      </div>
    </section>
  );
}
