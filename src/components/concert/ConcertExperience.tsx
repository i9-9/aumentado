"use client";

import { Line, OrbitControls, useVideoTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Crowd, type PersonData } from "./Crowd";
import { type ConcertQualitySettings, useConcertQuality } from "./useConcertQuality";

const SPOT_COLORS: [number, number, number][] = [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
];
const SPOT_X = [-9, -5.5, -2, 2, 5.5, 9];
const BPM = 120;
const BEAT = (2 * Math.PI * BPM) / 60;
const _target = new THREE.Vector3();
function buildCrowd(rows: number): PersonData[] {
  const people: PersonData[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = -8; col <= 8; col++) {
      people.push({
        x: col * 1.4 + (Math.random() - 0.5) * 0.4,
        z: -14 - row * 2.5 + (Math.random() - 0.5) * 0.5,
      });
    }
  }
  return people;
}

/* ── Truss beam: 4-chord aluminum with X-bracing ─────────────────────── */
function TrussBeam({ y, z, xMin = -10, xMax = 10 }: { y: number; z: number; xMin?: number; xMax?: number }) {
  const L = xMax - xMin;
  const cx = (xMin + xMax) / 2;
  const hw = 0.11;
  const r = 0.016;
  const pw = 1.8;
  const n = Math.max(1, Math.round(L / pw));
  const segW = L / n;
  const diagLen = Math.sqrt(segW * segW + (hw * 2) ** 2);
  const ang = Math.atan2(hw * 2, segW);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#7a7a90", metalness: 0.9, roughness: 0.18 }),
    [],
  );
  return (
    <group>
      {([[hw, hw], [hw, -hw], [-hw, hw], [-hw, -hw]] as [number, number][]).map(([dy, dz], i) => (
        <mesh key={i} position={[cx, y + dy, z + dz]} material={mat}>
          <boxGeometry args={[L, r * 2, r * 2]} />
        </mesh>
      ))}
      {Array.from({ length: n }).flatMap((_, s) => {
        const xc = xMin + (s + 0.5) * segW;
        return [
          <mesh key={`fa${s}`} position={[xc, y, z + hw]} rotation={[0, 0, ang]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
          <mesh key={`fb${s}`} position={[xc, y, z + hw]} rotation={[0, 0, -ang]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
          <mesh key={`ta${s}`} position={[xc, y + hw, z]} rotation={[0, ang, 0]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
          <mesh key={`tb${s}`} position={[xc, y + hw, z]} rotation={[0, -ang, 0]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
        ];
      })}
      {[xMin, xMax].map((xe) => (
        <mesh key={`cap${xe}`} position={[xe, y, z]} material={mat}><boxGeometry args={[r * 2, hw * 2, hw * 2]} /></mesh>
      ))}
    </group>
  );
}

/* ── Vertical truss column ───────────────────────────────────────────── */
function TrussColumn({ x, yMin, yMax, z }: { x: number; yMin: number; yMax: number; z: number }) {
  const H = yMax - yMin;
  const cy = (yMin + yMax) / 2;
  const hw = 0.09;
  const r = 0.014;
  const ph = 1.5;
  const n = Math.max(1, Math.round(H / ph));
  const segH = H / n;
  const diagLen = Math.sqrt(segH * segH + (hw * 2) ** 2);
  const ang = Math.atan2(hw * 2, segH);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#7a7a90", metalness: 0.9, roughness: 0.18 }),
    [],
  );
  return (
    <group>
      {([[hw, hw], [hw, -hw], [-hw, hw], [-hw, -hw]] as [number, number][]).map(([dx, dz], i) => (
        <mesh key={i} position={[x + dx, cy, z + dz]} material={mat}><boxGeometry args={[r * 2, H, r * 2]} /></mesh>
      ))}
      {Array.from({ length: n }).flatMap((_, s) => {
        const yc = yMin + (s + 0.5) * segH;
        return [
          <mesh key={`ca${s}`} position={[x, yc, z + hw]} rotation={[0, 0, ang]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
          <mesh key={`cb${s}`} position={[x, yc, z + hw]} rotation={[0, 0, -ang]} material={mat}><boxGeometry args={[diagLen, r, r]} /></mesh>,
        ];
      })}
    </group>
  );
}

/* ── PA Tower: standalone lighting + sound tower ─────────────────────── */
function PATower({ x, z, side }: { x: number; z: number; side: 1 | -1 }) {
  const towerH = 14.5;
  const boomY = 12.2;
  const boomInnerX = x - side * 4.8;

  return (
    <group>
      {/* Main vertical column */}
      <TrussColumn x={x} yMin={0} yMax={towerH} z={z} />

      {/* Base foot plates */}
      {([-0.7, 0.7] as number[]).map((dz) => (
        <mesh key={dz} position={[x, 0.05, z + dz]}>
          <boxGeometry args={[0.95, 0.08, 0.14]} />
          <meshStandardMaterial color="#555566" metalness={0.75} roughness={0.4} />
        </mesh>
      ))}

      {/* Horizontal boom at top */}
      <TrussBeam y={boomY} z={z} xMin={Math.min(x, boomInnerX)} xMax={Math.max(x, boomInnerX)} />

      {/* PA line array — 6 boxes hanging from inner end of boom */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <group key={k} position={[boomInnerX, boomY - 0.5 - k * 0.52, z]}>
          <mesh castShadow={false}>
            <boxGeometry args={[0.58, 0.48, 0.32]} />
            <meshStandardMaterial color="#0e0e0e" roughness={0.96} />
          </mesh>
          {/* Speaker grille face toward audience */}
          <mesh position={[0, 0, -side * 0.162]}>
            <boxGeometry args={[0.48, 0.4, 0.02]} />
            <meshStandardMaterial color="#181818" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Suspension rigging cable from column top to PA array */}
      <Line
        points={[[x, towerH - 0.05, z], [boomInnerX, boomY - 0.15, z]]}
        color="#444455"
        lineWidth={1}
        opacity={0.7}
        transparent
      />

      {/* Moving head fixtures on boom (2 per tower) */}
      {[1.2, 2.8].map((offset, j) => {
        const fx = x - side * offset;
        return (
          <group key={j} position={[fx, boomY + 0.06, z]}>
            <mesh>
              <boxGeometry args={[0.22, 0.09, 0.22]} />
              <meshStandardMaterial color="#1a1a22" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* Yoke arms */}
            {[-0.14, 0.14].map((dz2) => (
              <mesh key={dz2} position={[0, -0.16, dz2]}>
                <boxGeometry args={[0.035, 0.3, 0.035]} />
                <meshStandardMaterial color="#111118" metalness={0.75} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, -0.32, 0]} rotation={[Math.PI, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.055, 0.26, 10]} />
              <meshStandardMaterial color="#111118" metalness={0.65} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ── Main video screen — THREE.VideoTexture desde /public/cdh.mp4 ─────── */
const SCREEN_W = 28;
const SCREEN_H = 15.75; // 16:9 exacto (28 × 9/16)

/*
 * VideoScreen usa useVideoTexture (drei) que crea un <video> element,
 * lo conecta al pipeline WebGL como THREE.VideoTexture y lo actualiza
 * cada frame automáticamente. Sin iframes, sin overlays, sin glitches.
 * El video se streamea en chunks desde /public — no necesita descargarse completo.
 */
function VideoScreen() {
  const tex = useVideoTexture("/cdh_opt.mp4", {
    loop: true,
    muted: true,
    playsInline: true,
    crossOrigin: "anonymous",
    start: true,
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  return (
    /* rotation Y=π: gira el plano para que su cara visible mire hacia −Z (el público) */
    <mesh position={[0, SCREEN_H / 2, -0.04]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[SCREEN_W, SCREEN_H]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function MainScreen() {
  return (
    <group position={[0, 1.25, 7.06]}>
      {/* Bezel/estructura detrás de la pantalla (+z = lejos del público) */}
      <mesh position={[0, SCREEN_H / 2, 0.22]}>
        <boxGeometry args={[SCREEN_W + 0.6, SCREEN_H + 0.6, 0.4]} />
        <meshStandardMaterial color="#050505" roughness={0.97} />
      </mesh>

      {/* Fondo negro mientras el video no bufferizó suficiente */}
      <mesh position={[0, SCREEN_H / 2, -0.03]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Video: Suspense maneja el estado de carga sin bloquear la escena */}
      <Suspense fallback={null}>
        <VideoScreen />
      </Suspense>

      {/* Luz que rebota de la pantalla hacia el escenario */}
      <pointLight
        position={[0, SCREEN_H / 2, -0.8]}
        intensity={5}
        color="#ddeeff"
        distance={15}
        decay={2}
      />
    </group>
  );
}



/* ── Stage shadow box ────────────────────────────────────────────────── */
function ShadowBox({ args, position, rotation, color, metalness = 0, roughness = 0.8, castShadow = true }: { args: [number,number,number]; position?: [number,number,number]; rotation?: [number,number,number]; color: string; metalness?: number; roughness?: number; castShadow?: boolean }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

/* ── Animated show lights ────────────────────────────────────────────── */
function ShowLights({ spotsRef, spotsMidRef, bulbsRef }: { spotsRef: React.RefObject<THREE.SpotLight[]>; spotsMidRef: React.RefObject<THREE.SpotLight[]>; bulbsRef: React.RefObject<THREE.Mesh[]> }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    spotsRef.current.forEach((sl, i) => {
      if (!sl) return;
      const sx = SPOT_X[i]; const phase = i*(Math.PI/3); const sweep = Math.sin(t*0.8+phase)*0.25;
      sl.position.set(sx,11,-4); sl.lookAt(_target.set(sx+sweep*6,0,2));
      sl.intensity = 45+Math.abs(Math.sin(t*BEAT*0.5+phase))*35;
    });
    spotsMidRef.current.forEach((sl, i) => {
      if (!sl) return;
      const sx = [-7,0,7][i]; const ph = i*1.2; const sweep = Math.sin(t*0.6+ph)*0.4;
      sl.position.set(sx,11,-4); sl.lookAt(_target.set(sx+sweep*5,0,2));
      sl.intensity = 28+Math.abs(Math.sin(t*BEAT+ph))*22;
    });
    bulbsRef.current.forEach((b,i) => {
      if (!b) return;
      b.scale.setScalar(0.9+Math.abs(Math.sin(t*BEAT+i))*0.3);
    });
  });
  return null;
}

/* ── Post processing ─────────────────────────────────────────────────── */
function PostFX({ settings }: { settings: ConcertQualitySettings }) {
  if (!settings.enableBloom) return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.9} intensity={settings.bloomIntensity} mipmapBlur />
    </EffectComposer>
  );
}

/* ── Main scene ──────────────────────────────────────────────────────── */
export function ConcertExperience() {
  const { settings } = useConcertQuality();
  const spotsRef = useRef<THREE.SpotLight[]>([]);
  const spotsMidRef = useRef<THREE.SpotLight[]>([]);
  const bulbsRef = useRef<THREE.Mesh[]>([]);

  const spotColors = useMemo(() => SPOT_COLORS.map(([r,g,b]) => new THREE.Color(r,g,b)), []);
  const crowd = useMemo(() => buildCrowd(settings.crowdRows), [settings.crowdRows]);

  return (
    <>
      <color attach="background" args={["#050201"]} />
      <fog attach="fog" args={["#050201", 26, 62]} />

      <ambientLight intensity={0.06} color="#ffffff" />
      <hemisphereLight intensity={0.05} color="#ffffff" groundColor="#111111" />
      <pointLight position={[-9, 9, 2]} intensity={10} color="#ffffff" distance={18} decay={2} />
      <pointLight position={[9, 9, 2]} intensity={10} color="#ffffff" distance={18} decay={2} />

      <directionalLight
        position={[0, 25, -10]} intensity={1.0} color="#ffd8a8" castShadow
        shadow-mapSize={[settings.shadowMapSize, settings.shadowMapSize]}
        shadow-camera-far={80} shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30} shadow-bias={-0.0002}
      />

      {/* Cámara automática — orbita lentamente alrededor del escenario */}
      <OrbitControls
        target={[0, 5, 3]}
        minDistance={4} maxDistance={60}
        minPolarAngle={0.15} maxPolarAngle={Math.PI / 2.05}
        enableDamping dampingFactor={0.05}
        autoRotate autoRotateSpeed={0.45}
      />

      <group>
        {/* ── Floor ── */}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
          <planeGeometry args={[70,55]} />
          <meshStandardMaterial color="#000000" roughness={0.6} metalness={0.1} />
        </mesh>

        {/* ── Stage (tarima) ── */}
        <ShadowBox args={[22,1.2,14]} position={[0,0.6,0]} color="#000000" roughness={0.85} />
        <ShadowBox args={[22,0.1,0.3]} position={[0,1.25,-7]} color="#333338" metalness={0.85} roughness={0.4} castShadow={false} />
        {/* Stage edge LED strip */}
        <mesh position={[0,1.26,-7.05]} castShadow={false}>
          <boxGeometry args={[22,0.04,0.04]} />
          <meshStandardMaterial color="#ffffff" emissive="#aaccff" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>


        {/* ── Gran pantalla LED principal ── */}
        <MainScreen />

        {/* ── Front truss beam ── */}
        <TrussBeam y={11} z={-4} xMin={-9.5} xMax={9.5} />

        {/* ── Torres PA: 2 frontales + 2 laterales flanqueando la pantalla ── */}
        <PATower x={-9.5} z={-4} side={-1} />
        <PATower x={ 9.5} z={-4} side={ 1} />
        <PATower x={-14}  z={ 3} side={-1} />
        <PATower x={ 14}  z={ 3} side={ 1} />

        {/* ── Spot fixtures en el truss frontal ── */}
        {SPOT_X.map((sx, i) => {
          const col = spotColors[i];
          return (
            <group key={`spot-${i}`}>
              <mesh position={[sx,11.42,-4]}><boxGeometry args={[0.26,0.1,0.26]} /><meshStandardMaterial color="#1a1a22" metalness={0.7} roughness={0.4} /></mesh>
              <mesh position={[sx-0.19,11.18,-4]}><boxGeometry args={[0.04,0.34,0.04]} /><meshStandardMaterial color="#111118" metalness={0.75} roughness={0.4} /></mesh>
              <mesh position={[sx+0.19,11.18,-4]}><boxGeometry args={[0.04,0.34,0.04]} /><meshStandardMaterial color="#111118" metalness={0.75} roughness={0.4} /></mesh>
              <mesh position={[sx,11.02,-4]} rotation={[Math.PI,0,0]}><cylinderGeometry args={[0.16,0.08,0.38,12]} /><meshStandardMaterial color="#111118" metalness={0.65} roughness={0.4} /></mesh>
              <mesh ref={(m) => { if (m) bulbsRef.current[i] = m; }} position={[sx,10.82,-4]}>
                <sphereGeometry args={[0.09,14,14]} />
                <meshStandardMaterial color={col} emissive={col} emissiveIntensity={3.5} toneMapped={false} />
              </mesh>
              <spotLight ref={(l) => { if (l) spotsRef.current[i] = l; }} position={[sx,11,-4]} angle={0.45} penumbra={0.55} distance={40} decay={1} intensity={60} color={col} />
            </group>
          );
        })}

        {/* Mid-span spots — en el mismo truss frontal, sin bloquear pantalla */}
        {[-7,0,7].map((sx,i)=>(
          <group key={`spot-mid-${i}`}>
            <spotLight ref={(l)=>{ if(l) spotsMidRef.current[i]=l; }} position={[sx,11,-4]} angle={0.35} penumbra={0.55} distance={35} decay={1} intensity={40} color="#ffffff" />
          </group>
        ))}



        {/* ── Público sentado ── */}
        <Crowd people={crowd} />
      </group>

      <ShowLights spotsRef={spotsRef} spotsMidRef={spotsMidRef} bulbsRef={bulbsRef} />

      <PostFX settings={settings} />
    </>
  );
}
