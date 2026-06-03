"use client";

import {
  getBeat,
  getBeatPhase,
  isCaptureMode,
  musicStore,
} from "@/store/musicStore";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { V5Audio } from "./V5Audio";
import { V5FrameStepBridge } from "./V5FrameStepBridge";
import { V5KeyboardShortcuts } from "./V5KeyboardShortcuts";

export type HeroV5Props = {
  /** Modo grabación: tamaño fijo, sin UI, solo cámara automática */
  capture?: boolean;
  /** Reloj por frame (cuadro a cuadro desde Playwright) */
  frameCapture?: boolean;
  width?: number;
  height?: number;
};

const PHI = 1.6180339887;
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);

/** Placas por eje (×3 ejes). Antes 90 → 270 total; ahora 130 → 390. */
const SLABS_PER_AXIS = 130;

/** Convergencia paralela cada N beats (16 compases ≈ 64 beats en 4/4) */
const CONVERGE_EVERY_BEATS = 64;
const CONVERGE_WIDTH_BEATS = 8;

const _spread = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

function h(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function convergeBlendBeat(beat: number): number {
  const beatInCycle = beat % CONVERGE_EVERY_BEATS;
  const dist = Math.abs(beatInCycle - CONVERGE_EVERY_BEATS / 2);
  if (dist > CONVERGE_WIDTH_BEATS) return 0;
  const u = 1 - dist / CONVERGE_WIDTH_BEATS;
  return u * u * (3 - 2 * u);
}

interface Slab {
  axis: 0 | 1 | 2;
  u: number;
  v: number;
  phase: number;
  phase2: number;
  amplitude: number;
  beatMul: number;
  beatMul2: number;
  w: number;
  h: number;
  thick: number;
  tilt: [number, number, number];
  matIdx: 0 | 1 | 2;
}

function buildSlabs(perAxis = 90): Slab[] {
  const slabs: Slab[] = [];

  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < perAxis; i++) {
      const idx = axis * perAxis + i;

      const r = Math.sqrt((i + 0.5) / perAxis) * 9.0;
      const angle = i * GOLDEN_ANGLE + (axis * Math.PI * 2) / 3;

      const base = 1.2 + (i % 8) * 0.55;
      const cycle = i % 3;
      const w = base * (cycle === 0 ? PHI * PHI : cycle === 1 ? PHI : 1.0);
      const hh = base * (cycle === 0 ? 1.0 : cycle === 1 ? 1.0 : PHI);

      const tilt: [number, number, number] = [
        (h(idx * 3 + 1) - 0.5) * 0.08,
        (h(idx * 7 + 2) - 0.5) * 0.08,
        (h(idx * 11 + 3) - 0.5) * 0.04,
      ];

      const mRnd = h(idx * 41);
      const matIdx = mRnd < 0.6 ? 0 : mRnd < 0.9 ? 1 : 2;
      const thick = 0.003 + h(idx * 53) * 0.008;

      const beatMul = 0.25 + (i % 8) * 0.125 + axis * 0.05;
      const beatMul2 = beatMul * PHI;

      slabs.push({
        axis: axis as 0 | 1 | 2,
        u: r * Math.cos(angle),
        v: r * Math.sin(angle),
        phase: i * GOLDEN_ANGLE + (axis * 2 * Math.PI) / 3,
        phase2: h(idx * 17) * Math.PI * 2,
        amplitude: 4.0 + (i % 5) * PHI * 0.6,
        beatMul,
        beatMul2,
        w,
        h: hh,
        thick,
        tilt,
        matIdx: matIdx as 0 | 1 | 2,
      });
    }
  }

  return slabs;
}

/*
 * Cámara automática a tempo + fly manual (como v3):
 *   W / ↑  adelante    S / ↓  atrás    A / ←  izq    D / →  der
 *   Q / PgUp  subir    E / PgDn  bajar   Shift ×3
 *   Arrastrar: pan · Rueda: zoom · Botón derecho: subir/bajar
 */
const DRAG_PAN = 0.012;
const WHEEL_ZOOM = 0.04;

function AnimatedCamera() {
  const { camera, gl } = useThree();
  const capture = useSyncExternalStore(
    musicStore.subscribe,
    isCaptureMode,
    () => false,
  );

  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const autoPos = useMemo(() => new THREE.Vector3(), []);
  const ofs = useMemo(() => new THREE.Vector3(), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const rgt = useMemo(() => new THREE.Vector3(), []);
  const keys = useRef(new Set<string>());
  const pointer = useRef({
    active: false,
    right: false,
    lastX: 0,
    lastY: 0,
  });
  const wheelImpulse = useRef(0);

  useEffect(() => {
    if (capture) return;
    const dn = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [capture]);

  useEffect(() => {
    if (capture) return;
    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      pointer.current.active = true;
      pointer.current.right = e.button === 2;
      pointer.current.lastX = e.clientX;
      pointer.current.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointer.current.active) return;
      const dx = e.clientX - pointer.current.lastX;
      const dy = e.clientY - pointer.current.lastY;
      pointer.current.lastX = e.clientX;
      pointer.current.lastY = e.clientY;

      fwd.subVectors(lookTarget, camera.position).normalize();
      rgt.crossVectors(fwd, camera.up).normalize();

      if (pointer.current.right) {
        vel.addScaledVector(camera.up, -dy * DRAG_PAN);
      } else {
        vel.addScaledVector(rgt, -dx * DRAG_PAN);
        vel.addScaledVector(camera.up, -dy * DRAG_PAN * 0.35);
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (!pointer.current.active) return;
      pointer.current.active = false;
      pointer.current.right = false;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      el.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelImpulse.current +=
        Math.sign(e.deltaY) * WHEEL_ZOOM * (e.shiftKey ? 3 : 1);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    el.style.cursor = "grab";
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.style.cursor = "";
      el.style.touchAction = "";
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [capture, gl, camera, fwd, rgt, lookTarget, vel]);

  useFrame(() => {
    const beatPhase = getBeatPhase();
    const w = beatPhase * 0.08;

    const px = 28 * Math.sin(w);
    const py = 16 * Math.sin(w * PHI);
    const pz = 28 * Math.cos(w / PHI);

    const sx = 10 * Math.sin(w * PHI * PHI + 1.1);
    const sy = 6 * Math.cos((w * PHI * PHI) / PHI + 2.3);
    const sz = 10 * Math.cos(w * PHI + 0.7);

    autoPos.set(px + sx, py + sy, pz + sz);

    lookTarget.set(0, 0, 0);
    fwd.subVectors(lookTarget, camera.position).normalize();
    rgt.crossVectors(fwd, camera.up).normalize();

    if (!capture) {
      const k = keys.current;
      const boost = k.has("ShiftLeft") || k.has("ShiftRight");
      const spd = boost ? 0.9 : 0.3;

      if (k.has("KeyW") || k.has("ArrowUp")) vel.addScaledVector(fwd, spd);
      if (k.has("KeyS") || k.has("ArrowDown")) vel.addScaledVector(fwd, -spd);
      if (k.has("KeyA") || k.has("ArrowLeft")) vel.addScaledVector(rgt, -spd);
      if (k.has("KeyD") || k.has("ArrowRight")) vel.addScaledVector(rgt, spd);
      if (k.has("KeyQ") || k.has("PageUp")) vel.addScaledVector(camera.up, spd);
      if (k.has("KeyE") || k.has("PageDown"))
        vel.addScaledVector(camera.up, -spd);

      if (wheelImpulse.current !== 0) {
        vel.addScaledVector(fwd, -wheelImpulse.current);
        wheelImpulse.current = 0;
      }

      vel.multiplyScalar(0.8);
      ofs.add(vel);
      ofs.multiplyScalar(0.93);
    }

    camera.position.copy(autoPos).add(capture ? _origin : ofs);

    const roll = Math.sin(w * PHI * PHI) * 0.7;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(lookTarget);
  });

  return null;
}

function ConPlanes() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slabs = useMemo(() => buildSlabs(SLABS_PER_AXIS), []);

  const materials = useMemo(
    () => [
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#bec2c6"),
        emissive: new THREE.Color("#03060a"),
        shininess: 180,
        specular: new THREE.Color("#8ab0cc"),
        flatShading: false,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#3d7878"),
        emissive: new THREE.Color("#010e0e"),
        shininess: 160,
        specular: new THREE.Color("#70c8c8"),
        flatShading: false,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#1e3250"),
        emissive: new THREE.Color("#000508"),
        shininess: 120,
        specular: new THREE.Color("#4070b0"),
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    ],
    [],
  );

  useFrame(() => {
    const beat = getBeat();
    const beatPhase = getBeatPhase();
    const cf = convergeBlendBeat(beat);

    if (groupRef.current) {
      const spreadRot = beatPhase * 0.002;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(spreadRot, 0, cf);
    }

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = slabs[i];

      const raw1 = Math.sin(beatPhase * s.beatMul + s.phase);
      const eased = Math.sign(raw1) * Math.pow(Math.abs(raw1), 1 / PHI);
      const raw2 = Math.sin(beatPhase * s.beatMul2 + s.phase2) * 0.3;
      const offset = s.amplitude * (eased + raw2);

      if (s.axis === 0) _spread.set(offset, s.u, s.v);
      else if (s.axis === 1) _spread.set(s.u, offset, s.v);
      else _spread.set(s.u, s.v, offset);

      mesh.position.lerpVectors(_spread, _origin, cf);

      mesh.rotation.x = THREE.MathUtils.lerp(s.tilt[0], 0, cf);
      mesh.rotation.y = THREE.MathUtils.lerp(s.tilt[1], 0, cf);
      mesh.rotation.z = THREE.MathUtils.lerp(s.tilt[2], 0, cf);
    });
  });

  return (
    <group ref={groupRef}>
      {slabs.map((s, i) => {
        const args: [number, number, number, number, number, number] =
          s.axis === 0
            ? [s.thick, s.w, s.h, 1, 5, 5]
            : s.axis === 1
              ? [s.w, s.thick, s.h, 5, 1, 5]
              : [s.w, s.h, s.thick, 5, 5, 1];

        return (
          <mesh
            key={i}
            ref={(m) => {
              meshRefs.current[i] = m;
            }}
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

function Scene({
  capture,
  frameCapture,
}: {
  capture?: boolean;
  frameCapture?: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#0d0d0d"]} />
      <fogExp2 attach="fog" args={["#0d0d0d", 0.022]} />

      <ambientLight intensity={0.02} color="#ffffff" />
      <directionalLight position={[4, 7, 3]} intensity={5.5} color="#ffffff" />
      <directionalLight position={[-4, 1, -5]} intensity={0.55} color="#4499cc" />
      <pointLight
        position={[0, 0, 0]}
        intensity={1.2}
        color="#1a6060"
        distance={20}
        decay={2}
      />

      <AnimatedCamera />
      <ConPlanes />
      {capture && frameCapture ? <V5FrameStepBridge /> : null}
    </>
  );
}

export function HeroV5({
  capture = false,
  frameCapture = false,
  width,
  height,
}: HeroV5Props) {
  const sizeStyle =
    capture && width && height
      ? { width, height }
      : undefined;

  return (
    <section
      className={
        capture
          ? "relative overflow-hidden bg-black"
          : "relative h-[100dvh] overflow-hidden bg-black"
      }
      style={sizeStyle}
      data-v5-capture={capture ? "true" : undefined}
    >
      {!capture ? (
        <>
          <V5Audio />
          <V5KeyboardShortcuts />
        </>
      ) : null}
      <Canvas
        camera={{ fov: 55, position: [10, 3, 10], near: 0.1, far: 350 }}
        gl={{
          antialias: capture,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: capture,
        }}
        dpr={1}
        style={{ width: "100%", height: "100%" }}
        frameloop={capture && frameCapture ? "demand" : "always"}
      >
        <Scene capture={capture} frameCapture={frameCapture} />
      </Canvas>

      {!capture ? (
        <div data-v5-labels className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10 lg:px-12">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/15">
            05 · terminal
          </p>
          <p className="text-right font-mono text-[9px] leading-relaxed tracking-[0.15em] text-white/10">
            W S A D · Q E · ↑↓←→ · SHIFT boost
            <br />
            drag pan · rueda zoom · 1–9 BPM · R restart · H ui · F fullscreen
          </p>
        </div>
      ) : null}
    </section>
  );
}
