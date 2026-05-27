"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const PULSE_CYCLE = 3.5;
const PULSE_MAX_RADIUS = 13;

const _mouse = new THREE.Vector3();

function useParticleCounts() {
  const [counts, setCounts] = useState({ fine: 5000, glow: 400 });

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCounts({ fine: 2500, glow: 200 });
      else if (window.innerWidth < 1024) setCounts({ fine: 7000, glow: 350 });
      else setCounts({ fine: 14000, glow: 600 });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return counts;
}

function getMouseWorld(
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  target: THREE.Vector3,
) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  raycaster.ray.intersectPlane(plane, target);
  return target;
}

function createCloud(count: number, spread: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = Math.pow(Math.random(), 0.38) * spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  return positions;
}

function applyPulse(
  bx: number,
  by: number,
  bz: number,
  elapsed: number,
  out: THREE.Vector3,
) {
  const dist = Math.sqrt(bx * bx + by * by + bz * bz);
  const waveRadius = ((elapsed % PULSE_CYCLE) / PULSE_CYCLE) * PULSE_MAX_RADIUS;
  const band = 1.6;
  const diff = dist - waveRadius;

  out.set(bx, by, bz);
  if (Math.abs(diff) < band && dist > 0.001) {
    const push = (1 - Math.abs(diff) / band) * 0.42;
    out.x += (bx / dist) * push;
    out.y += (by / dist) * push;
    out.z += (bz / dist) * push;
  }
}

function ParticleLayer({
  count,
  spread,
  size,
  opacity,
  mouseRepulsion = false,
  pulseWave = false,
}: {
  count: number;
  spread: number;
  size: number;
  opacity: number;
  mouseRepulsion?: boolean;
  pulseWave?: boolean;
}) {
  const ref = useRef<THREE.Points>(null);
  const base = useMemo(() => createCloud(count, spread), [count, spread]);
  const current = useMemo(() => new Float32Array(base), [base]);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;
    const attr = ref.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    ref.current.rotation.y += delta * 0.025;
    ref.current.rotation.x = Math.sin(t * 0.15) * 0.08;

    const { camera, pointer } = state;
    if (mouseRepulsion) {
      getMouseWorld(camera, pointer, _mouse);
    }

    const smooth = 1 - Math.exp(-delta * 7);

    for (let i = 0; i < count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];

      if (pulseWave) {
        applyPulse(bx, by, bz, t, target);
      } else {
        target.set(bx, by, bz);
      }

      if (mouseRepulsion) {
        const dx = target.x - _mouse.x;
        const dy = target.y - _mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 2.4;
        if (dist < radius && dist > 0.001) {
          const force = (1 - dist / radius) * 1.8;
          target.x += (dx / dist) * force;
          target.y += (dy / dist) * force;
        }
      }

      arr[i * 3] += (target.x - arr[i * 3]) * smooth;
      arr[i * 3 + 1] += (target.y - arr[i * 3 + 1]) * smooth;
      arr[i * 3 + 2] += (target.z - arr[i * 3 + 2]) * smooth;
    }

    attr.needsUpdate = true;
  });

  useEffect(() => {
    current.set(base);
  }, [base, current]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[current, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
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

function CameraRig() {
  const { camera, pointer } = useThree();
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const parallax = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    parallax.current.x = THREE.MathUtils.lerp(
      parallax.current.x,
      pointer.x * 0.9,
      delta * 1.5,
    );
    parallax.current.y = THREE.MathUtils.lerp(
      parallax.current.y,
      pointer.y * 0.55,
      delta * 1.5,
    );

    camera.position.x = parallax.current.x;
    camera.position.y = parallax.current.y;
    camera.position.z = 7.5 + Math.sin(t * 0.1) * 0.5;
    camera.lookAt(lookAt);
  });

  return null;
}

function Experience() {
  const { fine, glow } = useParticleCounts();

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 4, 20]} />
      <ParticleLayer
        count={fine}
        spread={9}
        size={0.045}
        opacity={0.55}
        pulseWave
      />
      <ParticleLayer
        count={glow}
        spread={7}
        size={0.14}
        opacity={0.28}
        mouseRepulsion
        pulseWave
      />
      <CameraRig />
    </>
  );
}

type SceneProps = {
  className?: string;
};

export function Scene({ className = "" }: SceneProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        key="scene-home"
        className="h-full w-full touch-none"
        camera={{ position: [0, 0, 7.5], fov: 52, near: 0.1, far: 35 }}
        dpr={[1, 1.5]}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <Experience />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_65%,rgba(0,0,0,0.85)_100%)]"
        aria-hidden
      />
    </div>
  );
}
