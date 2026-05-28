"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const SPOT_COLORS: [number, number, number][] = [
  [1, 0.2, 0.2],
  [0.2, 0.4, 1],
  [1, 1, 0.2],
  [0.2, 1, 0.4],
  [1, 0.3, 0.8],
  [1, 0.6, 0.1],
];

const SPOT_X = [-9, -5.5, -2, 2, 5.5, 9];
const BPM = 120;
const BEAT = (2 * Math.PI * BPM) / 60;

const _target = new THREE.Vector3();

function ShadowBox({
  args,
  position,
  rotation,
  color,
  metalness = 0,
  roughness = 0.8,
  castShadow = true,
}: {
  args: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  castShadow?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

function ShowLights({
  spotsRef,
  spotsMidRef,
  bulbsRef,
  stickLRef,
  stickRRef,
}: {
  spotsRef: React.RefObject<THREE.SpotLight[]>;
  spotsMidRef: React.RefObject<THREE.SpotLight[]>;
  bulbsRef: React.RefObject<THREE.Mesh[]>;
  stickLRef: React.RefObject<THREE.Mesh | null>;
  stickRRef: React.RefObject<THREE.Mesh | null>;
}) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    spotsRef.current.forEach((sl, i) => {
      if (!sl) return;
      const sx = SPOT_X[i];
      const phase = i * (Math.PI / 3);
      const sweep = Math.sin(t * 0.8 + phase) * 0.25;
      sl.position.set(sx, 11, -4);
      sl.lookAt(_target.set(sx + sweep * 6, 0, 2));
      sl.intensity = 45 + Math.abs(Math.sin(t * BEAT * 0.5 + phase)) * 35;
    });

    spotsMidRef.current.forEach((sl, i) => {
      if (!sl) return;
      const sx = [-7, 0, 7][i];
      const ph = i * 1.2;
      const sweep = Math.sin(t * 0.6 + ph) * 0.4;
      sl.position.set(sx, 11, 1);
      sl.lookAt(_target.set(sx + sweep * 5, 0, 1));
      sl.intensity = 28 + Math.abs(Math.sin(t * BEAT + ph)) * 22;
    });

    bulbsRef.current.forEach((b, i) => {
      if (!b) return;
      const sc = 0.9 + Math.abs(Math.sin(t * BEAT + i)) * 0.3;
      b.scale.setScalar(sc);
    });

    const hit = Math.abs(Math.sin(t * BEAT));
    if (stickLRef.current) stickLRef.current.rotation.z = 0.4 - hit * 0.6;
    if (stickRRef.current) stickRRef.current.rotation.z = -0.4 + hit * 0.6;
  });

  return null;
}

export function ConcertExperience() {
  const spotsRef = useRef<THREE.SpotLight[]>([]);
  const spotsMidRef = useRef<THREE.SpotLight[]>([]);
  const bulbsRef = useRef<THREE.Mesh[]>([]);
  const stickLRef = useRef<THREE.Mesh | null>(null);
  const stickRRef = useRef<THREE.Mesh | null>(null);

  const crowd = useMemo(() => {
    const items: {
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = -8; col <= 8; col++) {
        const h = 1.6 + Math.random() * 0.3;
        items.push({
          size: [0.45, h, 0.25],
          pos: [
            col * 1.4 + (Math.random() - 0.5) * 0.4,
            h / 2,
            -14 - row * 2.5 + (Math.random() - 0.5) * 0.5,
          ],
        });
      }
    }
    return items;
  }, []);

  const drumY = 1.2;

  return (
    <>
      <color attach="background" args={["#020108"]} />
      <fog attach="fog" args={["#020108", 30, 70]} />

      <ambientLight intensity={0.05} color="#4a3366" />
      <hemisphereLight
        intensity={0.05}
        color="#4a3366"
        groundColor="#0d0814"
      />

      <directionalLight
        position={[0, 25, -10]}
        intensity={1.2}
        color="#fff2d9"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0002}
      />

      <OrbitControls
        target={[0, 4, 0]}
        minDistance={8}
        maxDistance={55}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.05}
      />

      <group>
        {/* Piso */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 50]} />
          <meshStandardMaterial color="#14100d" roughness={0.85} metalness={0} />
        </mesh>

        {/* Tarima */}
        <ShadowBox args={[22, 1.2, 14]} position={[0, 0.6, 0]} color="#3f2612" roughness={0.9} />
        <ShadowBox args={[22, 0.1, 0.3]} position={[0, 1.25, -7]} color="#333338" metalness={0.85} roughness={0.4} />
        <ShadowBox args={[3, 1.2, 8]} position={[0, 0.6, -11]} color="#3f2612" roughness={0.9} />

        {/* Fondo */}
        <ShadowBox args={[22, 12, 0.3]} position={[0, 7.2, 7.1]} color="#0d0d0d" metalness={0.1} roughness={0.8} />
        <ShadowBox args={[0.3, 12, 14]} position={[-11.1, 7.2, 0]} color="#590505" roughness={0.95} />
        <ShadowBox args={[0.3, 12, 14]} position={[11.1, 7.2, 0]} color="#590505" roughness={0.95} />
        <ShadowBox args={[22.6, 2.5, 14]} position={[0, 13.5, 0]} color="#590505" roughness={0.95} />

        {/* Truss */}
        <ShadowBox args={[20, 0.25, 0.25]} position={[0, 11, -4]} color="#333338" metalness={0.85} roughness={0.4} />
        <ShadowBox args={[20, 0.25, 0.25]} position={[0, 11, 1]} color="#333338" metalness={0.85} roughness={0.4} />
        <ShadowBox args={[20, 0.25, 0.25]} position={[0, 11, 6]} color="#333338" metalness={0.85} roughness={0.4} />
        {(
          [
            [-9.5, -4],
            [9.5, -4],
            [-9.5, 6],
            [9.5, 6],
          ] as [number, number][]
        ).map(([x, z], i) => (
          <ShadowBox
            key={`col-${i}`}
            args={[0.25, 10, 0.25]}
            position={[x, 6.2, z]}
            color="#333338"
            metalness={0.85}
            roughness={0.4}
          />
        ))}

        {/* Spots — carcasas y bulbos */}
        {SPOT_X.map((sx, i) => {
          const [r, g, b] = SPOT_COLORS[i];
          const col = new THREE.Color(r, g, b);
          return (
            <group key={`spot-${i}`}>
              <mesh
                position={[sx, 11.35, -4]}
                rotation={[Math.PI, 0, 0]}
                castShadow
                receiveShadow
              >
                <cylinderGeometry args={[0.25, 0.09, 0.7, 12]} />
                <meshStandardMaterial color="#333338" metalness={0.85} roughness={0.4} />
              </mesh>
              <mesh
                ref={(m) => {
                  if (m) bulbsRef.current[i] = m;
                }}
                position={[sx, 11.05, -4]}
              >
                <sphereGeometry args={[0.11, 16, 16]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
              <spotLight
                ref={(l) => {
                  if (l) spotsRef.current[i] = l;
                }}
                position={[sx, 11, -4]}
                angle={0.45}
                penumbra={0.5}
                distance={40}
                decay={1}
                intensity={60}
                color={col}
                castShadow
              />
            </group>
          );
        })}

        {[-7, 0, 7].map((sx, i) => (
          <group key={`spot-mid-${i}`}>
            <spotLight
              ref={(l) => {
                if (l) spotsMidRef.current[i] = l;
              }}
              position={[sx, 11, 1]}
              angle={0.35}
              penumbra={0.5}
              distance={35}
              decay={1}
              intensity={40}
              color="#ccccff"
            />
          </group>
        ))}

        {/* Amps */}
        {(
          [
            ["ampL1", -9.5, -0.5],
            ["ampL2", -7.8, -0.5],
            ["ampR1", 9.5, -0.5],
            ["ampR2", 7.8, -0.5],
          ] as [string, number, number][]
        ).map(([name, x, z]) => (
          <group key={name}>
            <ShadowBox args={[1.6, 1.8, 0.9]} position={[x, 2.4, z]} color="#141414" roughness={0.95} />
            <mesh position={[x, 2.4, z - 0.48]}>
              <boxGeometry args={[1.3, 1.5, 0.05]} />
              <meshStandardMaterial color="#1e1e1e" roughness={1} />
            </mesh>
            <mesh position={[x + 0.55, 2.7, z - 0.47]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color="#33ff66" toneMapped={false} />
            </mesh>
          </group>
        ))}

        <ShadowBox args={[1.8, 1.2, 1]} position={[-9.5, 1.2, 0.8]} color="#141414" roughness={0.95} />
        <ShadowBox args={[1.8, 1.2, 1]} position={[9.5, 1.2, 0.8]} color="#141414" roughness={0.95} />

        {[-12.5, 12.5].map((x) =>
          [0, 1, 2].map((k) => (
            <ShadowBox
              key={`pa-${x}-${k}`}
              args={[1.2, 1.4, 1]}
              position={[x, 0.7 + k * 1.45, -5]}
              color="#141414"
              roughness={0.95}
            />
          )),
        )}

        {/* Batería */}
        <mesh
          position={[0.5, drumY + 0.62, 3.5]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.6, 0.6, 0.7, 32]} />
          <meshStandardMaterial color="#991414" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[-0.4, drumY + 1.0, 2.5]} castShadow receiveShadow>
          <cylinderGeometry args={[0.225, 0.225, 0.25, 24]} />
          <meshStandardMaterial color="#ccccdd" metalness={1} roughness={0.05} />
        </mesh>
        {(
          [
            [0.3, drumY + 1.55, 2.9],
            [1.1, drumY + 1.4, 3.1],
          ] as [number, number, number][]
        ).map((p, i) => (
          <mesh key={`tom-${i}`} position={p} castShadow receiveShadow>
            <cylinderGeometry args={[0.19, 0.19, 0.22, 20]} />
            <meshStandardMaterial color="#991414" metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[-1.0, drumY + 1.8, 3.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.03, 32]} />
          <meshStandardMaterial color="#ccccdd" metalness={1} roughness={0.05} />
        </mesh>
        <mesh position={[-0.8, drumY + 1.5, 2.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.03, 32]} />
          <meshStandardMaterial color="#ccccdd" metalness={1} roughness={0.05} />
        </mesh>
        <mesh ref={stickLRef} position={[-0.15, drumY + 1.6, 2.6]} rotation={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.015, 0.015, 0.55, 8]} />
          <meshStandardMaterial color="#996633" roughness={0.8} />
        </mesh>
        <mesh ref={stickRRef} position={[0.15, drumY + 1.6, 2.6]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.015, 0.015, 0.55, 8]} />
          <meshStandardMaterial color="#996633" roughness={0.8} />
        </mesh>

        {/* Micros */}
        {(
          [
            [0, -4.5],
            [-2.5, -3.5],
            [2.5, -3.5],
          ] as [number, number][]
        ).map(([x, z], i) => (
          <group key={`mic-${i}`}>
            <mesh position={[x, drumY + 1.3, z]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.4, 8]} />
              <meshStandardMaterial color="#ccccdd" metalness={1} roughness={0.05} />
            </mesh>
            <mesh position={[x, drumY + 2.2, z]} castShadow>
              <sphereGeometry args={[0.065, 12, 12]} />
              <meshStandardMaterial color="#333338" metalness={0.85} roughness={0.4} />
            </mesh>
            <mesh position={[x, drumY + 1.21, z]}>
              <cylinderGeometry args={[0.175, 0.175, 0.05, 16]} />
              <meshStandardMaterial color="#333338" metalness={0.85} roughness={0.4} />
            </mesh>
          </group>
        ))}

        {/* Monitores */}
        {(
          [
            [-3, -5.5],
            [0, -5.8],
            [3, -5.5],
          ] as [number, number][]
        ).map(([x, z], i) => (
          <ShadowBox
            key={`mon-${i}`}
            args={[0.9, 0.3, 0.6]}
            position={[x, drumY + 0.75, z]}
            rotation={[-0.35, 0, 0]}
            color="#141414"
            roughness={0.95}
          />
        ))}

        <Line
          points={[
            [-2, 1.22, -3],
            [-3, 1.22, -2],
            [-4, 1.22, 0],
            [-5, 1.22, 2],
          ]}
          color="#4d4d4d"
          lineWidth={1}
          transparent
          opacity={0.8}
        />

        {/* Público */}
        {crowd.map((c, i) => (
          <mesh key={`aud-${i}`} position={c.pos} receiveShadow>
            <boxGeometry args={c.size} />
            <meshStandardMaterial color="#26201a" roughness={1} />
          </mesh>
        ))}
      </group>

      <ShowLights
        spotsRef={spotsRef}
        spotsMidRef={spotsMidRef}
        bulbsRef={bulbsRef}
        stickLRef={stickLRef}
        stickRRef={stickRRef}
      />

      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.3}
          luminanceSmoothing={0.85}
          intensity={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}
