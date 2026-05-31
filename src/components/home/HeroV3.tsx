"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/*
 * v3 — three families of rectangular slabs, each perpendicular to one
 * world axis. Slabs oscillate sinusoidally — two keyframes in loop,
 * exactly as Infini-D would produce with keyframe interpolation.
 *
 * The camera flies through the structure: close → far → close.
 * Distances range 2–18 units so the frame goes from fully covered in
 * slabs to almost pure black, matching the original animation.
 *
 * φ governs frequencies, phases, layout, dimensions, and easing.
 */

const PHI          = 1.6180339887;
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI); // ≈ 137.508°

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

      // Fibonacci spiral — even coverage, no gaps or clusters
      const r     = Math.sqrt((i + 0.5) / perAxis) * 9.0;
      const angle = i * GOLDEN_ANGLE + (axis * Math.PI * 2) / 3;

      // Architectural scale — camera flies between these
      const base  = 1.2 + (i % 8) * 0.55;
      const cycle = i % 3;
      const w  = base * (cycle === 0 ? PHI * PHI : cycle === 1 ? PHI : 1.0);
      const hh = base * (cycle === 0 ? 1.0 : cycle === 1 ? 1.0 : PHI);

      const tilt: [number, number, number] = [
        (h(idx * 3 + 1) - 0.5) * 0.08,
        (h(idx * 7 + 2) - 0.5) * 0.08,
        (h(idx * 11 + 3) - 0.5) * 0.04,
      ];

      // Material: 60% grey, 30% teal, 10% dark navy
      const mRnd   = h(idx * 41);
      const matIdx = mRnd < 0.60 ? 0 : mRnd < 0.90 ? 1 : 2;

      // No depth — true planes, edge-on = line
      const thick = 0.003 + h(idx * 53) * 0.008;

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

/*
 * Camera path — 3D Lissajous with three φ-related frequencies:
 *   X: ω
 *   Y: ω × φ
 *   Z: ω / φ
 * Three irrational multiples → path never repeats, always turning.
 * Secondary term on each axis (amplitude ×1/φ, frequency ×φ²) adds
 * tight hairpin turns when primary and secondary partially cancel.
 */
function AnimatedCamera() {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const w = 0.62; // fast — like the promo video

    // Primary Lissajous
    const px =  22 * Math.sin(t * w);
    const py =  13 * Math.sin(t * w * PHI);
    const pz =  22 * Math.cos(t * w / PHI);

    // Secondary layer — creates hairpin acceleration moments
    const sx =  8 * Math.sin(t * w * PHI * PHI + 1.1);
    const sy =  5 * Math.cos(t * w * PHI * PHI / PHI + 2.3);
    const sz =  8 * Math.cos(t * w * PHI + 0.7);

    camera.position.set(px + sx, py + sy, pz + sz);

    // Pronounced roll — heightens sense of speed
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

  // Minimal env map — simulates Infini-D "reflectivity": grey planes picking
  // up the cyan of nearby teal planes (inter-object reflection)
  const envMap = useMemo(() => {
    const size = 4;
    const data = new Uint8Array(size * size * 4 * 6);
    // Each face: very dark with a faint teal tint
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = 8;   // R
      data[i + 1] = 22;  // G — teal bias
      data[i + 2] = 28;  // B
      data[i + 3] = 255;
    }
    const tex = new THREE.DataArrayTexture(data, size, size, 6);
    tex.format  = THREE.RGBAFormat;
    tex.mapping = THREE.CubeReflectionMapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const materials = useMemo(() => [
    // 0: Grey — primary. glow≈0.02, reflectivity≈0.15
    new THREE.MeshPhongMaterial({
      color:            new THREE.Color("#bec2c6"),
      emissive:         new THREE.Color("#03060a"), // Infini-D "glow" param
      shininess:        180,
      specular:         new THREE.Color("#8ab0cc"),
      envMap,
      reflectivity:     0.15,                       // picks up teal from nearby slabs
      combine:          THREE.MixOperation,
      flatShading:      false,
    }),
    // 1: Teal — glow≈0.04, reflectivity≈0.20
    new THREE.MeshPhongMaterial({
      color:            new THREE.Color("#3d7878"),
      emissive:         new THREE.Color("#010e0e"),
      shininess:        160,
      specular:         new THREE.Color("#70c8c8"),
      envMap,
      reflectivity:     0.20,
      combine:          THREE.MixOperation,
      flatShading:      false,
    }),
    // 2: Dark navy — flat shading for faceted low-poly Infini-D look
    new THREE.MeshPhongMaterial({
      color:            new THREE.Color("#1e3250"),
      emissive:         new THREE.Color("#000508"),
      shininess:        120,
      specular:         new THREE.Color("#4070b0"),
      flatShading:      true,
    }),
  ], [envMap]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Very slow group drift — adds secondary parallax to camera flight
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

function ConFieldScene() {
  return (
    <>
      <color attach="background" args={["#0d0d0d"]} />

      {/* Infini-D atmosphere: very subtle exponential fog for depth */}
      <fogExp2 attach="fog" args={["#0d0d0d", 0.022]} />

      <ambientLight intensity={0.02} color="#ffffff" />

      {/* Key light — main directional, like Infini-D studio default */}
      <directionalLight position={[4, 7, 3]} intensity={5.5} color="#ffffff" />

      {/* Blue-cyan fill — pronounced, matches reference */}
      <directionalLight position={[-4, 1, -5]} intensity={0.55} color="#4499cc" />

      {/* Center point — simulates inter-reflection: teal planes "glowing" onto greys */}
      <pointLight position={[0, 0, 0]} intensity={1.2} color="#1a6060" distance={20} decay={2} />

      <AnimatedCamera />
      <ConPlanes />
    </>
  );
}

export function HeroV3() {
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
        <ConFieldScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10 lg:px-12">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/15">
          03
        </p>
      </div>
    </section>
  );
}
