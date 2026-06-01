"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);
// W = 1/PHI — base frequency unit. Every time-domain freq = W × PHIⁿ = PHI^(n−1)
// n: …  −3      −2      −1      0      1      2      3      4  …
// Hz: … 0.146  0.236  0.382  0.618  1.000  1.618  2.618  4.236 …
const W = 1 / PHI;

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
        amplitude: PHI * PHI * PHI * 2 + (i % 5) * PHI,  // [PHI³×2, PHI³×2 + 4PHI] ≈ [8.5, 15.0]
        speed: PHI * PHI + h(idx * 13) * PHI,   // [PHI², PHI²+PHI] = [2.618, 4.236]
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
/*
 * Keyboard fly controls (additive over auto-path):
 *   W / ↑        forward       Shift  ×3 boost
 *   S / ↓        backward
 *   A / ←        strafe left
 *   D / →        strafe right
 *   Q / PgUp     rise
 *   E / PgDn     descend
 *
 * Releasing keys decays velocity then offset → camera drifts back to path.
 */
function AnimatedCamera() {
  const { camera } = useThree();

  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const autoPos    = useMemo(() => new THREE.Vector3(), []);
  const ofs        = useMemo(() => new THREE.Vector3(), []);
  const vel        = useMemo(() => new THREE.Vector3(), []);
  const fwd        = useMemo(() => new THREE.Vector3(), []);
  const rgt        = useMemo(() => new THREE.Vector3(), []);
  const keys       = useRef(new Set<string>());

  useEffect(() => {
    const dn = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup",   up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup",   up);
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = keys.current;

    // Auto-path (golden frequencies)
    const theta    = t * (W * W) + Math.sin(t * (W * W * W)) * PHI;
    const phi      = W * Math.sin(t * (W * W));
    const d1       = Math.sin(t / W);
    const d2       = Math.sin(t / (W * W)) * W;
    const distNorm = ((d1 + d2) + (1 + W)) / (2 * (1 + W));
    const dist     = W + 56 * Math.pow(distNorm, W);

    autoPos.set(
      dist * Math.cos(theta) * Math.cos(phi),
      dist * Math.sin(phi),
      dist * Math.sin(theta) * Math.cos(phi),
    );

    // Camera-local axes from previous frame (one-frame lag is imperceptible)
    fwd.subVectors(lookTarget, camera.position).normalize();
    rgt.crossVectors(fwd, camera.up).normalize();

    const boost = k.has("ShiftLeft") || k.has("ShiftRight");
    const spd   = boost ? 0.9 : 0.3;

    if (k.has("KeyW") || k.has("ArrowUp"))    vel.addScaledVector(fwd,       spd);
    if (k.has("KeyS") || k.has("ArrowDown"))  vel.addScaledVector(fwd,      -spd);
    if (k.has("KeyA") || k.has("ArrowLeft"))  vel.addScaledVector(rgt,      -spd);
    if (k.has("KeyD") || k.has("ArrowRight")) vel.addScaledVector(rgt,       spd);
    if (k.has("KeyQ") || k.has("PageUp"))     vel.addScaledVector(camera.up,  spd);
    if (k.has("KeyE") || k.has("PageDown"))   vel.addScaledVector(camera.up, -spd);

    vel.multiplyScalar(0.80); // friction — velocity bleeds off quickly
    ofs.add(vel);
    ofs.multiplyScalar(0.93); // offset slowly collapses back to auto-path

    camera.position.copy(autoPos).add(ofs);

    const inside = Math.max(0, 1 - dist / 7);
    const roll   = Math.sin(t / (W * W)) * (W + inside / (W * W * W));
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);

    lookTarget.set(
      inside * Math.sin(t / W)       * (1 / (W * W * W)),
      inside * Math.sin(t * W)       * (1 / (W * W)),
      inside * Math.cos(t / (W * W)) * (1 / W),
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
      groupRef.current.rotation.y = t * (W * W * W * W * W * W);             // W⁶ = PHI⁻⁶ ≈ 0.056
      groupRef.current.rotation.x = Math.sin(t * (W * W * W * W * W * W * W)) * (1 / PHI); // W⁷ ≈ 0.034
    }

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = slabs[i];

      const spd   = s.speed * Math.pow(PHI, s.axis);
      const raw1  = Math.sin(t * spd + s.phase);
      const eased = Math.sign(raw1) * Math.pow(Math.abs(raw1), 1 / PHI);
      const raw2  = Math.sin(t * spd * PHI + s.phase2) * (W * W); // W² = PHI⁻² ≈ 0.382
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
        camera={{ fov: 72, position: [10, 3, 10], near: 0.1, far: 350 }}
        gl={{
          antialias:            false,
          toneMapping:          THREE.NoToneMapping,
          outputColorSpace:     THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: true,
        }}
        dpr={1}
      >
        <ConFieldScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10 lg:px-12">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/15">
          03
        </p>
        <p className="font-mono text-[9px] leading-relaxed tracking-[0.15em] text-white/10 text-right">
          W S A D · Q E · ↑↓←→<br />
          SHIFT boost
        </p>
      </div>
    </section>
  );
}
