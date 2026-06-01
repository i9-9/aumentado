import * as THREE from "three";

export type TexMode = "root" | "mono" | "wave";
export type EnvMode = "dark" | "fog" | "void";

/** Raíz digital védica (1–9; 0 → 9) */
export function digitalRoot(n: number): number {
  return n === 0 ? 9 : ((n - 1) % 9) + 1;
}

const HUE: Record<number, number> = {
  1: 270,
  2: 165,
  3: 20,
  4: 210,
  5: 38,
  6: 330,
  7: 100,
  8: 0,
  9: 200,
};

function hsl(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

export function makeVedicTexture(texMode: TexMode, cellSize: number): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = Math.round(S * 2.618);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const TH = canvas.height;
  const cols = Math.floor(S / cellSize);
  const rows = Math.floor(TH / cellSize);

  ctx.fillStyle = "#08080f";
  ctx.fillRect(0, 0, S, TH);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c + 1;
      const root = digitalRoot(n);
      let color: string;

      if (texMode === "root") {
        const [rr, g, b] = hsl(HUE[root], 70, 48);
        color = `rgb(${Math.round(rr * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      } else if (texMode === "mono") {
        const v = Math.round((root / 9) * 200);
        color = `rgb(${v},${v},${v})`;
      } else {
        const phase = (r + c) % 9;
        const [rr, g, b] = hsl((phase / 9) * 360, 60, 42);
        color = `rgb(${Math.round(rr * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      }

      const pad = cellSize > 8 ? 1 : 0;
      ctx.fillStyle = color;
      ctx.fillRect(
        c * cellSize + pad,
        r * cellSize + pad,
        cellSize - pad * 2,
        cellSize - pad * 2,
      );

      if (cellSize >= 16) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.font = `${Math.round(cellSize * 0.45)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          String(root),
          c * cellSize + cellSize / 2,
          r * cellSize + cellSize / 2,
        );
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export const MONO_W = 1.0;
export const MONO_H = 2.618;
export const MONO_D = 0.38;

export function buildMonolithMaterials(
  texMode: TexMode,
  cellSize: number,
): THREE.Material[] {
  const tex = makeVedicTexture(texMode, cellSize);
  const matFront = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.25,
    metalness: 0.6,
  });
  const matSide = new THREE.MeshStandardMaterial({
    color: 0x0a0a14,
    roughness: 0.4,
    metalness: 0.8,
  });
  const matTop = new THREE.MeshStandardMaterial({
    color: 0x111120,
    roughness: 0.3,
    metalness: 0.7,
  });
  return [matSide, matSide, matTop, matTop, matFront, matFront];
}

export function disposeMaterials(materials: THREE.Material[]) {
  materials.forEach((m) => {
    const map = (m as THREE.MeshStandardMaterial).map;
    map?.dispose();
    m.dispose();
  });
}
