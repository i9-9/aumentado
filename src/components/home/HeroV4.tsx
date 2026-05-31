"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const PHI          = 1.6180339887;
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);

function h(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Slab {
  axis:      0 | 1 | 2;
  u:         number;
  v:         number;
  phase:     number;
  phase2:    number;
  amplitude: number;
  speed:     number;
  w:         number;
  h:         number;
  thick:     number;
  tilt:      [number, number, number];
  matIdx:    0 | 1 | 2;
}

function buildSlabs(perAxis = 90): Slab[] {
  const slabs: Slab[] = [];

  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < perAxis; i++) {
      const idx = axis * perAxis + i;

      const r     = Math.sqrt((i + 0.5) / perAxis) * 9.0;
      const angle = i * GOLDEN_ANGLE + (axis * Math.PI * 2) / 3;

      const base  = 1.2 + (i % 8) * 0.55;
      const cycle = i % 3;
      const w  = base * (cycle === 0 ? PHI * PHI : cycle === 1 ? PHI : 1.0);
      const hh = base * (cycle === 0 ? 1.0 : cycle === 1 ? 1.0 : PHI);

      const tilt: [number, number, number] = [
        (h(idx * 3 + 1) - 0.5) * 0.08,
        (h(idx * 7 + 2) - 0.5) * 0.08,
        (h(idx * 11 + 3) - 0.5) * 0.04,
      ];

      const mRnd   = h(idx * 41);
      const matIdx = mRnd < 0.60 ? 0 : mRnd < 0.90 ? 1 : 2;
      const thick  = 0.003 + h(idx * 53) * 0.008;

      slabs.push({
        axis: axis as 0 | 1 | 2,
        u: r * Math.cos(angle),
        v: r * Math.sin(angle),
        phase:  i * GOLDEN_ANGLE + (axis * 2 * Math.PI) / 3,
        phase2: h(idx * 17) * Math.PI * 2,
        amplitude: 4.0 + (i % 5) * PHI * 0.6,
        speed: 1.8 + h(idx * 13) * 0.9,
        w, h: hh, thick, tilt,
        matIdx: matIdx as 0 | 1 | 2,
      });
    }
  }

  return slabs;
}

function AnimatedCamera() {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const w = 0.62;

    const px =  22 * Math.sin(t * w);
    const py =  13 * Math.sin(t * w * PHI);
    const pz =  22 * Math.cos(t * w / PHI);

    const sx =  8 * Math.sin(t * w * PHI * PHI + 1.1);
    const sy =  5 * Math.cos(t * w * PHI * PHI / PHI + 2.3);
    const sz =  8 * Math.cos(t * w * PHI + 0.7);

    camera.position.set(px + sx, py + sy, pz + sz);

    const roll = Math.sin(t * w * PHI * PHI) * 0.7;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);

    camera.lookAt(0, 0, 0);
  });

  return null;
}

function ConPlanes() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slabs    = useMemo(() => buildSlabs(), []);

  const materials = useMemo(() => [
    new THREE.MeshPhongMaterial({
      color:       new THREE.Color("#bec2c6"),
      emissive:    new THREE.Color("#03060a"),
      shininess:   180,
      specular:    new THREE.Color("#8ab0cc"),
      flatShading: false,
      side:        THREE.DoubleSide,
    }),
    new THREE.MeshPhongMaterial({
      color:       new THREE.Color("#3d7878"),
      emissive:    new THREE.Color("#010e0e"),
      shininess:   160,
      specular:    new THREE.Color("#70c8c8"),
      flatShading: false,
      side:        THREE.DoubleSide,
    }),
    new THREE.MeshPhongMaterial({
      color:       new THREE.Color("#1e3250"),
      emissive:    new THREE.Color("#000508"),
      shininess:   120,
      specular:    new THREE.Color("#4070b0"),
      flatShading: true,
      side:        THREE.DoubleSide,
    }),
  ], []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.012;
    }

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = slabs[i];

      const spd   = s.speed * Math.pow(PHI, s.axis);
      const raw1  = Math.sin(t * spd + s.phase);
      const eased = Math.sign(raw1) * Math.pow(Math.abs(raw1), 1 / PHI);
      const raw2  = Math.sin(t * spd * PHI + s.phase2) * 0.30;
      const offset = s.amplitude * (eased + raw2);

      if (s.axis === 0)      mesh.position.set(offset, s.u, s.v);
      else if (s.axis === 1) mesh.position.set(s.u, offset, s.v);
      else                   mesh.position.set(s.u, s.v, offset);
    });
  });

  return (
    <group ref={groupRef}>
      {slabs.map((s, i) => {
        const args: [number, number, number, number, number, number] =
          s.axis === 0 ? [s.thick, s.w, s.h, 1, 5, 5]
          : s.axis === 1 ? [s.w, s.thick, s.h, 5, 1, 5]
          : [s.w, s.h, s.thick, 5, 5, 1];

        return (
          <mesh
            key={i}
            ref={(m) => { meshRefs.current[i] = m; }}
            rotation={s.tilt}
          >
            <boxGeometry args={args} />
            <primitive object={materials[s.matIdx]} attach="material" />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#0d0d0d"]} />
      <fogExp2 attach="fog" args={["#0d0d0d", 0.022]} />

      <ambientLight intensity={0.02} color="#ffffff" />
      <directionalLight position={[4, 7, 3]} intensity={5.5} color="#ffffff" />
      <directionalLight position={[-4, 1, -5]} intensity={0.55} color="#4499cc" />
      <pointLight position={[0, 0, 0]} intensity={1.2} color="#1a6060" distance={20} decay={2} />

      <AnimatedCamera />
      <ConPlanes />
    </>
  );
}

export function HeroV4() {
  return (
    <section className="relative h-[100dvh] overflow-hidden bg-black">
      <Canvas
        camera={{ fov: 55, position: [10, 3, 10], near: 0.1, far: 350 }}
        gl={{
          antialias:        false,
          toneMapping:      THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
        }}
        dpr={1}
      >
        <Scene />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10 lg:px-12">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/15">
          04
        </p>
      </div>
    </section>
  );
}
