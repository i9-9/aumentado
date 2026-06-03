"use client";

import { getBeatPhase, isCaptureMode, musicStore } from "@/store/musicStore";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { V5Audio } from "./V5Audio";
import { V5KeyboardShortcuts } from "./V5KeyboardShortcuts";

export type HeroV6Props = {
  capture?: boolean;
  width?: number;
  height?: number;
};

const PHI = 1.6180339887;
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);
const SPIKE_COUNT = 600;

const DRAG_PAN = 0.012;
const WHEEL_ZOOM = 0.04;

function h(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface SpikeData {
  x: number;
  z: number;
  phase: number;
  speed: number;
  restY: number;
  embedDepth: number;
  bodyLen: number;
  tipLen: number;
  radius: number;
  matIdx: 0 | 1 | 2;
}

function buildSpikes(count: number): SpikeData[] {
  const arr: SpikeData[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count) * 24.0;
    const angle = i * GOLDEN_ANGLE;
    const bodyLen = 1.5 + h(i * 7 + 1) * 2.2;
    const tipLen = 0.5 + h(i * 13 + 2) * 0.7;
    const radius = 0.02 + h(i * 19 + 3) * 0.05;
    const mRnd = h(i * 41);
    const matIdx: 0 | 1 | 2 = mRnd < 0.6 ? 0 : mRnd < 0.9 ? 1 : 2;
    // restY = tip height when at rest (above the floor)
    const restY = 0.3 + h(i * 23 + 4) * 2.5;
    const embedDepth = 0.1 + h(i * 31 + 5) * 0.45;
    arr.push({
      x: r * Math.cos(angle),
      z: r * Math.sin(angle),
      phase: h(i * 37 + 6) * Math.PI * 2,
      speed: 0.18 + h(i * 43 + 7) * 0.6,
      restY,
      embedDepth,
      bodyLen,
      tipLen,
      radius,
      matIdx,
    });
  }
  return arr;
}

// V5 palette colors
const MAT_COLORS = [
  new THREE.Color("#bec2c6"),
  new THREE.Color("#3d7878"),
  new THREE.Color("#1e3250"),
];

/** Y world-position of spike apex (tip). 0 = floor. Negative = embedded. */
function spikeTipY(globalPhase: number, s: SpikeData): number {
  let raw = (globalPhase * s.speed + s.phase) % (Math.PI * 2);
  if (raw < 0) raw += Math.PI * 2;
  const t = raw / (Math.PI * 2); // 0..1

  if (t < 0.25) {
    // Fast fall — gravity cubic ease-in
    const u = t / 0.25;
    return THREE.MathUtils.lerp(s.restY, -s.embedDepth, u * u * u);
  } else if (t < 0.42) {
    // Hold embedded
    return -s.embedDepth;
  } else {
    // Slow retract — ease-out quad
    const u = (t - 0.42) / 0.58;
    return THREE.MathUtils.lerp(-s.embedDepth, s.restY, 1 - (1 - u) * (1 - u));
  }
}

function SpikeField() {
  const spikes = useMemo(() => buildSpikes(SPIKE_COUNT), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const tipRef = useRef<THREE.InstancedMesh>(null);

  // Unit cylinder: height 1, extends y=-0.5..+0.5
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1), []);

  // Cone apex pointing DOWN after rotation
  const tipGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 8);
    g.rotateX(Math.PI); // apex flips to -Y
    return g;
  }, []);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#ffffff"),
        shininess: 160,
        specular: new THREE.Color("#8ab0cc"),
        flatShading: false,
      }),
    [],
  );

  const tipMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#ffffff"),
        shininess: 260,
        specular: new THREE.Color("#a0d0e8"),
        flatShading: true,
      }),
    [],
  );

  useEffect(() => {
    const bm = bodyRef.current;
    const tm = tipRef.current;
    if (!bm || !tm) return;
    for (let i = 0; i < spikes.length; i++) {
      bm.setColorAt(i, MAT_COLORS[spikes[i].matIdx]);
      tm.setColorAt(i, MAT_COLORS[spikes[i].matIdx]);
    }
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
  }, [spikes]);

  useFrame(() => {
    const bm = bodyRef.current;
    const tm = tipRef.current;
    if (!bm || !tm) return;
    const beatPhase = getBeatPhase();

    for (let i = 0; i < spikes.length; i++) {
      const s = spikes[i];
      const tipY = spikeTipY(beatPhase, s);

      // Cone: apex at tipY, center at tipY + tipLen/2
      dummy.position.set(s.x, tipY + s.tipLen * 0.5, s.z);
      dummy.scale.set(s.radius, s.tipLen, s.radius);
      dummy.updateMatrix();
      tm.setMatrixAt(i, dummy.matrix);

      // Cylinder: bottom at tipY + tipLen, center at tipY + tipLen + bodyLen/2
      dummy.position.set(s.x, tipY + s.tipLen + s.bodyLen * 0.5, s.z);
      dummy.scale.set(s.radius, s.bodyLen, s.radius);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
    }

    bm.instanceMatrix.needsUpdate = true;
    tm.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={tipRef} args={[tipGeo, tipMat, SPIKE_COUNT]} />
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, SPIKE_COUNT]} />
    </>
  );
}

function Floor() {
  const mat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#0d1114"),
        emissive: new THREE.Color("#020304"),
        shininess: 300,
        specular: new THREE.Color("#5080a8"),
        flatShading: false,
        side: THREE.FrontSide,
      }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[120, 120, 1, 1]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function AnimatedCamera() {
  const { camera, gl } = useThree();
  const capture = useSyncExternalStore(
    musicStore.subscribe,
    isCaptureMode,
    () => false,
  );

  const lookTarget = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
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
    const w = beatPhase * 0.055; // slower orbit than v5

    // Orbit around the floor, staying above it
    const px = 22 * Math.sin(w);
    const py = 10 + 4 * Math.sin(w * PHI * 0.4);
    const pz = 22 * Math.cos(w / PHI);

    const sx = 5 * Math.sin(w * PHI + 1.1);
    const sy = 2 * Math.cos(w * PHI * 0.7 + 2.3);
    const sz = 5 * Math.cos(w * PHI * 0.5 + 0.7);

    autoPos.set(px + sx, Math.max(3.5, py + sy), pz + sz);

    lookTarget.set(0, 1.5, 0);
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

    camera.position.copy(autoPos).add(capture ? new THREE.Vector3() : ofs);

    const roll = Math.sin(w * PHI * PHI) * 0.35;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(lookTarget);
  });

  return null;
}

function Scene({ capture }: { capture?: boolean }) {
  return (
    <>
      <color attach="background" args={["#0d0d0d"]} />
      <fogExp2 attach="fog" args={["#0d0d0d", 0.018]} />

      <ambientLight intensity={0.02} color="#ffffff" />
      <directionalLight position={[4, 7, 3]} intensity={5.5} color="#ffffff" />
      <directionalLight
        position={[-4, 1, -5]}
        intensity={0.55}
        color="#4499cc"
      />
      <pointLight
        position={[0, 0, 0]}
        intensity={1.2}
        color="#1a6060"
        distance={30}
        decay={2}
      />
      {/* Extra floor-grazing light for metallic sheen */}
      <pointLight
        position={[0, 0.3, 0]}
        intensity={2.0}
        color="#203050"
        distance={18}
        decay={2}
      />

      <AnimatedCamera />
      <Floor />
      <SpikeField />
    </>
  );
}

export function HeroV6({
  capture = false,
  width,
  height,
}: HeroV6Props) {
  const sizeStyle =
    capture && width && height ? { width, height } : undefined;

  return (
    <section
      className={
        capture
          ? "relative overflow-hidden bg-black"
          : "relative h-dvh overflow-hidden bg-black"
      }
      style={sizeStyle}
    >
      {!capture ? (
        <>
          <V5Audio />
          <V5KeyboardShortcuts />
        </>
      ) : null}
      <Canvas
        camera={{ fov: 55, position: [12, 10, 12], near: 0.1, far: 350 }}
        gl={{
          antialias: capture,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: capture,
        }}
        dpr={1}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene capture={capture} />
      </Canvas>

      {!capture ? (
        <div data-v5-labels className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10 lg:px-12">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/15">
            06 · spikes
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
