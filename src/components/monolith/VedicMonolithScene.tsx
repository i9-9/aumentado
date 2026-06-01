"use client";

import {
  buildMonolithMaterials,
  disposeMaterials,
  MONO_D,
  MONO_H,
  MONO_W,
  type EnvMode,
  type TexMode,
} from "@/lib/vedicMonolith";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type MonolithSceneProps = {
  texMode: TexMode;
  cellSize: number;
  animOn: boolean;
  floatOn: boolean;
  envMode: EnvMode;
};

function MonolithEnvironment({ envMode }: { envMode: EnvMode }) {
  const { scene } = useThree();

  useEffect(() => {
    if (envMode === "dark") {
      scene.background = new THREE.Color(0x080810);
      scene.fog = new THREE.FogExp2(0x080810, 0.04);
    } else if (envMode === "fog") {
      scene.background = new THREE.Color(0x1a1a2e);
      scene.fog = new THREE.Fog(0x1a1a2e, 4, 18);
    } else {
      scene.background = new THREE.Color(0x000000);
      scene.fog = null;
    }
  }, [envMode, scene]);

  return null;
}

function MonolithCamera({ animOnRef }: { animOnRef: MutableRefObject<boolean> }) {
  const { camera, gl } = useThree();
  const drag = useRef({ active: false, prevX: 0, prevY: 0 });
  const rot = useRef({
    y: 0.2,
    x: 0.05,
    targetY: 0.2,
    targetX: 0.05,
    zoom: 7,
    targetZoom: 7,
  });

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.prevX = e.clientX;
      drag.current.prevY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };

    const onUp = (e: PointerEvent) => {
      drag.current.active = false;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const r = rot.current;
      r.targetY += (e.clientX - drag.current.prevX) * 0.008;
      r.targetX += (e.clientY - drag.current.prevY) * 0.004;
      r.targetX = Math.max(-0.5, Math.min(0.5, r.targetX));
      drag.current.prevX = e.clientX;
      drag.current.prevY = e.clientY;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rot.current.targetZoom = Math.max(
        3,
        Math.min(15, rot.current.targetZoom + e.deltaY * 0.01),
      );
    };

    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.style.touchAction = "";
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame(() => {
    const r = rot.current;
    r.y += (r.targetY - r.y) * 0.06;
    r.x += (r.targetX - r.x) * 0.06;
    r.zoom += (r.targetZoom - r.zoom) * 0.06;

    if (animOnRef.current) r.targetY += 0.003;

    camera.position.set(
      Math.sin(r.y) * r.zoom,
      1.5 + r.x * 2,
      Math.cos(r.y) * r.zoom,
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function MonolithMesh({
  texMode,
  cellSize,
  floatOn,
}: {
  texMode: TexMode;
  cellSize: number;
  floatOn: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ptLightRef = useRef<THREE.PointLight>(null);
  const materials = useMemo(
    () => buildMonolithMaterials(texMode, cellSize),
    [texMode, cellSize],
  );

  useEffect(() => {
    return () => disposeMaterials(materials);
  }, [materials]);

  useEffect(() => {
    if (meshRef.current) meshRef.current.material = materials;
  }, [materials]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (meshRef.current) {
      meshRef.current.position.y = floatOn ? Math.sin(t * 0.7) * 0.06 : 0;
    }

    if (ptLightRef.current) {
      ptLightRef.current.intensity = 1.5 + Math.sin(t * 1.3) * 0.5;
      ptLightRef.current.color.setHSL((t * 0.04) % 1, 0.7, 0.5);
    }
  });

  return (
    <>
      <mesh ref={meshRef} castShadow material={materials}>
        <boxGeometry args={[MONO_W, MONO_H, MONO_D]} />
      </mesh>
      <pointLight
        ref={ptLightRef}
        position={[0, 0.5, 1.5]}
        intensity={2}
        distance={6}
      />
    </>
  );
}

export function VedicMonolithScene({
  texMode,
  cellSize,
  animOn,
  floatOn,
  envMode,
}: MonolithSceneProps) {
  const animOnRef = useRef(animOn);
  animOnRef.current = animOn;

  const ambientIntensity =
    envMode === "dark" ? 0.8 : envMode === "fog" ? 1.2 : 0.4;

  return (
    <>
      <MonolithEnvironment envMode={envMode} />
      <MonolithCamera animOnRef={animOnRef} />

      <ambientLight color={0x111130} intensity={ambientIntensity} />

      <directionalLight
        position={[3, 6, 4]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-4, 2, -2]} intensity={0.6} color={0x3344aa} />
      <directionalLight position={[0, 4, -6]} intensity={0.5} color={0x6622ff} />

      <MonolithMesh texMode={texMode} cellSize={cellSize} floatOn={floatOn} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -MONO_H / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          color={0x050508}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
    </>
  );
}
