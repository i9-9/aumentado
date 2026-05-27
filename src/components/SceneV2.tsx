"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function useGlowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.85)");
    g.addColorStop(0.4, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function useParticleCounts() {
  const [counts, setCounts] = useState({ fine: 5000, glow: 400, halo: 200 });
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCounts({ fine: 2500, glow: 220, halo: 120 });
      else if (window.innerWidth < 1024)
        setCounts({ fine: 7000, glow: 450, halo: 200 });
      else setCounts({ fine: 14000, glow: 700, halo: 350 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return counts;
}

function createCloud(count: number, spread: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = Math.pow(Math.random(), 0.35) * spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  return positions;
}

function ParticleLayer({
  count,
  spread,
  size,
  opacity,
  map,
  baseHue,
  rotSpeed = 0.02,
  hueShift = false,
}: {
  count: number;
  spread: number;
  size: number;
  opacity: number;
  map: THREE.Texture | null;
  baseHue: number;
  rotSpeed?: number;
  hueShift?: boolean;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => createCloud(count, spread), [count, spread]);
  const initColor = useMemo(
    () => new THREE.Color().setHSL(baseHue, 0.78, 0.68),
    [baseHue],
  );

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y += delta * rotSpeed;
    ref.current.rotation.x = Math.sin(t * 0.12) * 0.06;
    if (hueShift) {
      (ref.current.material as THREE.PointsMaterial).color.setHSL(
        (baseHue + t * 0.018) % 1,
        0.78,
        0.68,
      );
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        map={map ?? undefined}
        color={initColor}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function NebulaBand() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 2800;
  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.5 + Math.random() * 4.5;
      const spread = (Math.random() - 0.5) * 0.9;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = spread;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.006;
  });

  return (
    <points ref={ref} rotation={[0.42, 0, 0.18]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#818cf8"
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function CentralOrb() {
  const outerRef = useRef<THREE.Mesh>(null);
  const icoRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (outerRef.current) {
      const s = 1 + Math.sin(t * 0.85) * 0.1;
      outerRef.current.scale.setScalar(s);
    }
    if (icoRef.current) {
      icoRef.current.rotation.y = t * 0.22;
      icoRef.current.rotation.x = t * 0.16;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.14;
      ringRef.current.rotation.x = 1.1 + Math.sin(t * 0.06) * 0.18;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.09;
      ring2Ref.current.rotation.y = 0.8 + Math.sin(t * 0.05) * 0.12;
    }
  });

  return (
    <group>
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial
          color="#1d4ed8"
          transparent
          opacity={0.06}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.58, 32, 32]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.13}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial
          color="#93c5fd"
          transparent
          opacity={0.2}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial
          color="#e0f2fe"
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={icoRef}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial
          color="#60a5fa"
          wireframe
          transparent
          opacity={0.45}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.78, 0.012, 8, 90]} />
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.75}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[0.62, 0.008, 8, 80]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const SHAPES = [
  {
    position: [2.2, 0.6, -0.8] as [number, number, number],
    scale: 0.75,
    geometry: "torus" as const,
    speed: -0.18,
    color: "#a78bfa",
  },
  {
    position: [-1.8, -0.9, 0.5] as [number, number, number],
    scale: 0.55,
    geometry: "octahedron" as const,
    speed: 0.22,
    color: "#34d399",
  },
  {
    position: [0.9, -1.1, 1.2] as [number, number, number],
    scale: 0.45,
    geometry: "box" as const,
    speed: -0.15,
    color: "#f472b6",
  },
  {
    position: [-2.4, 1.1, -1.5] as [number, number, number],
    scale: 1.05,
    geometry: "torusKnot" as const,
    speed: 0.08,
    color: "#818cf8",
  },
];

function ShapeGeometry({ type }: { type: (typeof SHAPES)[0]["geometry"] }) {
  switch (type) {
    case "torus":
      return <torusGeometry args={[0.7, 0.22, 24, 48]} />;
    case "octahedron":
      return <octahedronGeometry args={[1, 0]} />;
    case "box":
      return <boxGeometry args={[1, 1, 1]} />;
    case "torusKnot":
      return <torusKnotGeometry args={[0.55, 0.16, 96, 12]} />;
  }
}

function FloatingShape({
  position,
  scale,
  geometry,
  speed,
  color,
}: (typeof SHAPES)[0]) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * speed;
    ref.current.rotation.y += delta * speed * 1.3;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <ShapeGeometry type={geometry} />
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={0.6}
        toneMapped={false}
      />
    </mesh>
  );
}

function FloatingShapes() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.04;
    group.current.rotation.x = Math.sin(t * 0.08) * 0.1;
  });
  return (
    <group ref={group}>
      {SHAPES.map((s) => (
        <FloatingShape key={s.geometry + s.position.join()} {...s} />
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera, pointer } = useThree();
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const parallax = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    parallax.current.x = THREE.MathUtils.lerp(
      parallax.current.x,
      pointer.x * 1.1,
      delta * 1.6,
    );
    parallax.current.y = THREE.MathUtils.lerp(
      parallax.current.y,
      pointer.y * 0.65,
      delta * 1.6,
    );
    camera.position.x = parallax.current.x;
    camera.position.y = parallax.current.y;
    camera.position.z = 7.2 + Math.sin(t * 0.1) * 0.55;
    camera.lookAt(lookAt);
  });

  return null;
}

function Experience() {
  const glowMap = useGlowTexture();
  const { fine, glow, halo } = useParticleCounts();

  return (
    <>
      <color attach="background" args={["#020010"]} />
      <fog attach="fog" args={["#020010", 5, 22]} />
      <ParticleLayer
        count={fine}
        spread={10}
        size={0.055}
        opacity={0.62}
        map={glowMap}
        baseHue={0.63}
        rotSpeed={0.02}
      />
      <ParticleLayer
        count={glow}
        spread={7}
        size={0.22}
        opacity={0.36}
        map={glowMap}
        baseHue={0.6}
        rotSpeed={-0.015}
        hueShift
      />
      <ParticleLayer
        count={halo}
        spread={5}
        size={0.5}
        opacity={0.21}
        map={glowMap}
        baseHue={0.75}
        rotSpeed={0.03}
        hueShift
      />
      <NebulaBand />
      <CentralOrb />
      <FloatingShapes />
      <CameraRig />
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.08}
          luminanceSmoothing={0.85}
          intensity={2.1}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

type SceneProps = {
  className?: string;
};

export function SceneV2({ className = "" }: SceneProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        key="scene-v2"
        className="h-full w-full touch-none"
        camera={{ position: [0, 0, 7.2], fov: 52, near: 0.1, far: 35 }}
        dpr={[1, 1.5]}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <Experience />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.8)_100%)]"
        aria-hidden
      />
    </div>
  );
}
