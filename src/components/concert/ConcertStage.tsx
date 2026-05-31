"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { ConcertExperience } from "./ConcertExperience";
import { useConcertQuality } from "./useConcertQuality";

type ConcertStageProps = {
  className?: string;
};

export function ConcertStage({ className = "" }: ConcertStageProps) {
  const { settings } = useConcertQuality();
  const dpr = useMemo(() => [1, settings.dprMax] as [number, number], [settings.dprMax]);

  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        key="concert-three"
        className="h-full w-full touch-none"
        shadows
        // Frontal: como espectador mirando el escenario desde el público
        camera={{ position: [0, 4.5, -12], fov: 65, near: 0.5, far: 120 }}
        dpr={dpr}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <ConcertExperience />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,1,8,0.3)_55%,rgba(2,1,8,0.78)_100%)]"
        aria-hidden
      />
    </div>
  );
}
