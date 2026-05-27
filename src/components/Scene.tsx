"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function useParticleCount() {
  const [count, setCount] = useState(5000);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCount(2000);
      else if (window.innerWidth < 1024) setCount(4500);
      else setCount(9000);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

function Particles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 0.55) * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.04;
    ref.current.rotation.x += delta * 0.015;
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
        color="#000000"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
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
      pointer.x * 1.2,
      delta * 1.8,
    );
    parallax.current.y = THREE.MathUtils.lerp(
      parallax.current.y,
      pointer.y * 0.7,
      delta * 1.8,
    );

    camera.position.x = parallax.current.x;
    camera.position.y = parallax.current.y;
    camera.position.z = 9 + Math.sin(t * 0.12) * 0.6;
    camera.lookAt(lookAt);
  });

  return null;
}

function Experience() {
  const count = useParticleCount();

  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      <fog attach="fog" args={["#ffffff", 6, 22]} />
      <Particles count={count} />
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
        className="h-full w-full touch-none"
        camera={{ position: [0, 0, 9], fov: 50, near: 0.1, far: 40 }}
        dpr={[1, 1.5]}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        gl={{ antialias: true, alpha: false }}
      >
        <Experience />
      </Canvas>
    </div>
  );
}
