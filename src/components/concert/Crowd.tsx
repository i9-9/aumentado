"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type PersonData = { x: number; z: number };

const _d = new THREE.Object3D();
const _c = new THREE.Color();

// 120 BPM — sincronizado con ShowLights
const _BEAT = (2 * Math.PI * 120) / 60;

const CHAIR_COLORS = ["#1a1228", "#12111f", "#1f1530", "#0f0e1c", "#160f26"];
const SKIN_TONES = ["#c68642", "#8d5524", "#e8b89a", "#6b3a2a", "#f1c27d", "#b07850"];
const SHIRT_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#1a0a2e", "#2d1b4e", "#3a0d5e", "#0a1628"];

/** Actualiza matrix + color */
function stamp(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  rx: number, ry: number, rz: number,
  hex: string,
) {
  _d.position.set(x, y, z);
  _d.scale.set(sx, sy, sz);
  _d.rotation.set(rx, ry, rz);
  _d.updateMatrix();
  mesh.setMatrixAt(i, _d.matrix);
  mesh.setColorAt(i, _c.set(hex));
}

/** Actualiza solo la matrix (para animación — sin tocar colores) */
function stampPos(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  rx: number, ry: number, rz: number,
) {
  _d.position.set(x, y, z);
  _d.scale.set(sx, sy, sz);
  _d.rotation.set(rx, ry, rz);
  _d.updateMatrix();
  mesh.setMatrixAt(i, _d.matrix);
}

export function Crowd({ people }: { people: PersonData[] }) {
  const n = people.length;

  const seatRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const armLRef = useRef<THREE.InstancedMesh>(null);
  const armRRef = useRef<THREE.InstancedMesh>(null);

  // Ref para que useFrame siempre tenga las posiciones actualizadas
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // Configuración inicial con matrices + colores
  useEffect(() => {
    const all = [seatRef, backRef, bodyRef, headRef, armLRef, armRRef];
    if (all.some((r) => !r.current)) return;

    people.forEach(({ x, z }, i) => {
      const chairHex = CHAIR_COLORS[i % CHAIR_COLORS.length];
      const skinHex = SKIN_TONES[i % SKIN_TONES.length];
      const shirtHex = SHIRT_COLORS[i % SHIRT_COLORS.length];
      const raised = i % 3 === 0;

      stamp(seatRef.current!, i, x, 0.47, z, 0.42, 0.06, 0.38, 0, 0, 0, chairHex);
      stamp(backRef.current!, i, x, 0.76, z - 0.18, 0.42, 0.52, 0.05, -0.1, 0, 0, chairHex);
      stamp(bodyRef.current!, i, x, 0.75, z - 0.02, 0.28, 0.44, 0.2, 0.06, 0, 0, shirtHex);
      stamp(headRef.current!, i, x, 1.07, z - 0.06, 0.21, 0.23, 0.2, 0, 0, 0, skinHex);

      if (raised) {
        stamp(armLRef.current!, i, x - 0.19, 1.22, z, 0.09, 0.38, 0.09, -0.15, 0, -0.22, shirtHex);
        stamp(armRRef.current!, i, x + 0.19, 1.22, z, 0.09, 0.38, 0.09, -0.15, 0, 0.22, shirtHex);
      } else {
        stamp(armLRef.current!, i, x - 0.19, 0.75, z, 0.09, 0.36, 0.09, 0.28, 0, -0.42, shirtHex);
        stamp(armRRef.current!, i, x + 0.19, 0.75, z, 0.09, 0.36, 0.09, 0.28, 0, 0.42, shirtHex);
      }
    });

    all.forEach((r) => {
      if (!r.current) return;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, [people]);

  // Animación: ondulación de cabezas y brazos al ritmo del beat
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const hr = headRef.current;
    const al = armLRef.current;
    const ar = armRRef.current;
    const br = bodyRef.current;
    if (!hr || !al || !ar || !br) return;

    peopleRef.current.forEach(({ x, z }, i) => {
      // Fase única por posición → ola que se propaga a través del público
      const phase = (x * 0.28 + z * 0.11 + i * 0.17) % (Math.PI * 2);

      // Bob suave (1.9 Hz ≈ un poco más lento que el beat)
      const bob = Math.sin(t * 1.9 + phase) * 0.04;

      // Ola de brazos sincronizada con el beat (0.5× BPM = 1 por cada 2 beats)
      const wave = Math.sin(t * _BEAT * 0.5 + phase);
      const raised = wave > 0;
      const lift = Math.max(0, wave) * 0.24;

      stampPos(br, i, x, 0.75 + bob * 0.5, z - 0.02, 0.28, 0.44, 0.2, 0.06, 0, 0);
      stampPos(hr, i, x, 1.07 + bob, z - 0.06, 0.21, 0.23, 0.2, 0, 0, 0);

      if (raised) {
        stampPos(al, i, x - 0.19, 1.22 + lift, z, 0.09, 0.38 + lift * 0.1, 0.09, -0.15 - lift * 0.6, 0, -0.22);
        stampPos(ar, i, x + 0.19, 1.22 + lift, z, 0.09, 0.38 + lift * 0.1, 0.09, -0.15 - lift * 0.6, 0, 0.22);
      } else {
        stampPos(al, i, x - 0.19, 0.75, z, 0.09, 0.36, 0.09, 0.28, 0, -0.42);
        stampPos(ar, i, x + 0.19, 0.75, z, 0.09, 0.36, 0.09, 0.28, 0, 0.42);
      }
    });

    br.instanceMatrix.needsUpdate = true;
    hr.instanceMatrix.needsUpdate = true;
    al.instanceMatrix.needsUpdate = true;
    ar.instanceMatrix.needsUpdate = true;
  });

  if (n === 0) return null;

  return (
    <>
      <instancedMesh ref={seatRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={backRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.78} />
      </instancedMesh>
      <instancedMesh ref={armLRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={armRRef} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </>
  );
}
