"use client";

import { Canvas } from "@react-three/fiber";
import { ConcertExperience } from "./ConcertExperience";

type ConcertStageProps = {
  className?: string;
};

export function ConcertStage({ className = "" }: ConcertStageProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        key="concert-three"
        className="h-full w-full touch-none"
        shadows
        camera={{ position: [28, 16, 28], fov: 50, near: 0.5, far: 120 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <ConcertExperience />
      </Canvas>
    </div>
  );
}
