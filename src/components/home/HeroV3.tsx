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
  skew:      number;   // parallelogram lean — shifts top/bottom edges sideways
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

      // Parallelogram skew: how far the top/bottom edges are offset sideways
      // Range: 15–45% of the shorter dimension
      const skew = (h(idx * 59) * 0.30 + 0.15) * Math.min(w, hh);

      slabs.push({
        axis: axis as 0 | 1 | 2,
        u: r * Math.cos(angle),
        v: r * Math.sin(angle),
        phase:  i * GOLDEN_ANGLE + (axis * 2 * Math.PI) / 3,
        phase2: h(idx * 17) * Math.PI * 2,
        amplitude: 4.0 + (i % 5) * PHI * 0.6,
        speed: 1.8 + h(idx * 13) * 0.9,
        w, h: hh, thick, skew, tilt,
        matIdx: matIdx as 0 | 1 | 2,
      });
    }
  }

  return slabs;
}

// Parallelogram geometry: top & bottom edges offset by `skew`.
function makeParallelogram(w: number, hh: number, skew: number, axis: 0|1|2): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pts: [number, number][] = [
    [-w/2 - skew, -hh/2],  // 0 bottom-left
    [ w/2 - skew, -hh/2],  // 1 bottom-right
    [ w/2 + skew,  hh/2],  // 2 top-right
    [-w/2 + skew,  hh/2],  // 3 top-left
  ];
  const pos = new Float32Array(4 * 3);
  pts.forEach(([a, b], i) => {
    if (axis === 0)      { pos[i*3]=0; pos[i*3+1]=a; pos[i*3+2]=b; }
    else if (axis === 1) { pos[i*3]=a; pos[i*3+1]=0; pos[i*3+2]=b; }
    else                 { pos[i*3]=a; pos[i*3+1]=b; pos[i*3+2]=0; }
  });
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

/*
 * Camera path — decoupled distance & angle:
 *   distance  oscillates fast (enters/exits cluster many times)
 *   angle     drifts slowly  (orbit changes over time)
 *
 * When inside (dist < 8): roll intensifies, lookAt wanders → spinning chaos.
 * When outside: roll settles, lookAt centers → moment of clarity.
 */
function AnimatedCamera() {
  const { camera } = useThree();
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Slow angular drift — orbit changes across the full animation
    const theta = t * 0.22 + Math.sin(t * 0.22 / PHI) * 0.9;
    const phi   = 0.45 * Math.sin(t * 0.17 * PHI);

    // Fast radial oscillation — enters and exits multiple times
    // Two φ-related frequencies → irregular cycle lengths
    const d1 = Math.sin(t * 0.85);
    const d2 = Math.sin(t * 0.85 * PHI) * 0.45;
    const distNorm = ((d1 + d2) + 1.45) / 2.9;          // 0 → 1
    const dist     = 1.2 + 24 * Math.pow(distNorm, 1.3); // 1.2 → 25

    camera.position.set(
      dist * Math.cos(theta) * Math.cos(phi),
      dist * Math.sin(phi),
      dist * Math.sin(theta) * Math.cos(phi),
    );

    // Inside factor: 1 when dist≈0, 0 when dist≥8
    const inside = Math.max(0, 1 - dist / 8);

    // Roll: subtle outside, wild spinning when inside
    const roll = Math.sin(t * 0.85 * PHI * PHI) * (0.3 + inside * 2.2);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);

    // LookAt wanders when inside — adds to disorientation
    lookTarget.set(
      inside * Math.sin(t * 2.1) * 5,
      inside * Math.sin(t * 1.6 / PHI) * 3.5,
      0,
    );
    camera.lookAt(lookTarget);
  });

  return null;
}

function ConPlanes() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slabs    = useMemo(() => buildSlabs(), []);

  const materials = useMemo(() => [
    // 0: Grey — primary
    new THREE.MeshPhongMaterial({
      color:       new THREE.Color("#bec2c6"),
      emissive:    new THREE.Color("#03060a"),
      shininess:   180,
      specular:    new THREE.Color("#8ab0cc"),
      flatShading: false,
      side:        THREE.DoubleSide,
    }),
    // 1: Teal
    new THREE.MeshPhongMaterial({
      color:       new THREE.Color("#3d7878"),
      emissive:    new THREE.Color("#010e0e"),
      shininess:   160,
      specular:    new THREE.Color("#70c8c8"),
      flatShading: false,
      side:        THREE.DoubleSide,
    }),
    // 2: Dark navy — faceted
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
        const geo = makeParallelogram(s.w, s.h, s.skew, s.axis);
        return (
          <mesh
            key={i}
            ref={(m) => { meshRefs.current[i] = m; }}
            rotation={s.tilt}
            geometry={geo}
          >
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

      {/* Key light — main directional */}
      <directionalLight position={[4, 7, 3]} intensity={7.5} color="#ffffff" />
      <directionalLight position={[-4, -7, -3]} intensity={3.5} color="#ffffff" />

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
