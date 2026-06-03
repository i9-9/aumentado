#!/usr/bin/env node
/**
 * Graba tomas v5 en 4K, 60 fps cuadro a cuadro (WebGL → frame → ffmpeg).
 *
 * Uso:
 *   npm run capture:v5:prores          # ProRes 4444 + audio (por defecto, máxima calidad)
 *   npm run capture:v5:prores:local    # idem, servidor local en :3001
 *   npm run capture:v5                 # H.264 CRF-8 + audio
 *   CAPTURE_CODEC=h264 node scripts/capture-v5.mjs --presets=5 --formats=landscape
 *
 * Variables de entorno:
 *   CAPTURE_CODEC          prores (default) | h264
 *   CAPTURE_QUALITY        4k (default) | 1080
 *   CAPTURE_DURATION_SEC   34 (default)
 *   CAPTURE_FPS            60 (default)
 *   CAPTURE_CRF            8  (solo h264)
 *   CAPTURE_OUT_DIR        captures/v5 (default)
 *   BASE_URL               http://localhost:3000 (default)
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ─── Resoluciones ──────────────────────────────────────────────────────────────
const FORMATS_4K = {
  landscape: { w: 3840, h: 2160 },
  portrait: { w: 2160, h: 3840 },
};

const FORMATS_1080 = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
};

const PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ─── Configuración ─────────────────────────────────────────────────────────────
const DURATION_SEC  = Number(process.env.CAPTURE_DURATION_SEC || 34);
const BASE_URL      = process.env.BASE_URL || "http://localhost:3000";
const QUALITY       = (process.env.CAPTURE_QUALITY || "4k").toLowerCase();
const FORMATS       = QUALITY === "1080" ? FORMATS_1080 : FORMATS_4K;
const FFMPEG_CRF    = Number(process.env.CAPTURE_CRF || 8);
const CAPTURE_FPS   = Number(process.env.CAPTURE_FPS || 60);
const OUT_DIR       = path.join(ROOT, process.env.CAPTURE_OUT_DIR || "captures/v5");

/** prores = ProRes 4444 .mov (para AE/Premiere) · h264 = H.264 .mp4 */
const CODEC = (process.env.CAPTURE_CODEC || "prores").toLowerCase();

/** PNG sin pérdida para ProRes · JPEG calidad alta para H.264 */
const USE_PNG = CODEC === "prores";

/** Pista de audio Terminal para mezclar en la salida final */
const AUDIO_SRC = path.join(ROOT, "public", "sgr", "3 - Terminal.wav");

// ─── Helpers ───────────────────────────────────────────────────────────────────
function portFromBaseUrl(url) {
  const u = new URL(url);
  if (u.port) return Number(u.port);
  return u.protocol === "https:" ? 443 : 80;
}

function parseArgs(argv) {
  const opts = {
    presets: [...PRESETS],
    formats: ["landscape", "portrait"],
    skipServer: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--presets=")) {
      opts.presets = arg
        .slice("--presets=".length)
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => n >= 1 && n <= 9);
    } else if (arg.startsWith("--formats=")) {
      opts.formats = arg
        .slice("--formats=".length)
        .split(",")
        .map((s) => s.trim())
        .filter((f) => f in FORMATS);
    } else if (arg === "--no-server") {
      opts.skipServer = true;
    }
  }
  return opts;
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Servidor no respondió en ${url}`);
}

function startProductionServer(port) {
  return spawn("npm", ["run", "start"], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, PORT: String(port) },
  });
}

// ─── ffmpeg helpers ────────────────────────────────────────────────────────────
function spawnFfmpeg(args) {
  return new Promise((resolve) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("exit", (code) => resolve(code === 0));
  });
}

async function probeFps(filePath) {
  return new Promise((resolve) => {
    const ff = spawn(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=avg_frame_rate",
        "-of", "csv=p=0",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    ff.stdout?.on("data", (d) => { out += d; });
    ff.on("exit", () => {
      const part = out.trim().split("/");
      if (part.length === 2 && Number(part[1])) {
        resolve((Number(part[0]) / Number(part[1])).toFixed(2));
      } else {
        resolve("?");
      }
    });
  });
}

/**
 * ProRes 4444 · 10-bit · audio PCM 24-bit
 * Perfecto para importar directo en After Effects o Premiere Pro en macOS.
 */
async function encodeFramesToMov(framesDir, movPath, fps) {
  const frameGlob = path.join(framesDir, "%06d.png");
  return spawnFfmpeg([
    "-y",
    "-framerate",  String(fps),
    "-i",          frameGlob,
    "-i",          AUDIO_SRC,
    "-c:v",        "prores_ks",
    "-profile:v",  "4444",       // ProRes 4444 (máxima calidad, soporte alpha)
    "-qscale:v",   "1",           // calidad máxima dentro de ProRes
    "-vendor",     "apl0",
    "-pix_fmt",    "yuva444p10le",
    "-c:a",        "pcm_s24le",   // audio PCM 24-bit sin pérdida
    "-shortest",                  // corta al fin del video
    movPath,
  ]);
}

/**
 * H.264 CRF-8 · audio AAC 320k  (opción rápida/ligera)
 */
async function encodeFramesToMp4(framesDir, mp4Path, fps) {
  const frameGlob = path.join(framesDir, `%06d.${USE_PNG ? "png" : "jpg"}`);
  return spawnFfmpeg([
    "-y",
    "-framerate",  String(fps),
    "-i",          frameGlob,
    "-i",          AUDIO_SRC,
    "-c:v",        "libx264",
    "-preset",     "slow",
    "-crf",        String(FFMPEG_CRF),
    "-pix_fmt",    "yuv420p",
    "-movflags",   "+faststart",
    "-c:a",        "aac",
    "-b:a",        "320k",
    "-shortest",
    mp4Path,
  ]);
}

// ─── Captura de frames ─────────────────────────────────────────────────────────
async function recordFrames(page, url, framesDir, fps, durationSec) {
  await fs.mkdir(framesDir, { recursive: true });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(
    () =>
      document.body.dataset.captureReady === "true" &&
      typeof window.__v5CaptureStep === "function",
    { timeout: 180_000 },
  );

  const totalFrames = Math.round(durationSec * fps);
  const canvas = page.locator("[data-v5-capture] canvas");
  const ext = USE_PNG ? "png" : "jpg";

  for (let i = 0; i < totalFrames; i++) {
    await page.evaluate(() => window.__v5CaptureStep());
    await canvas.screenshot({
      path: path.join(framesDir, `${String(i).padStart(6, "0")}.${ext}`),
      type: USE_PNG ? "png" : "jpeg",
      ...(USE_PNG ? {} : { quality: 98 }),
    });
    if (i > 0 && i % fps === 0) {
      const elapsed = (i / fps).toFixed(0);
      console.log(`   … ${i}/${totalFrames} frames (${elapsed}s / ${durationSec}s)`);
    }
  }
}

// ─── Servidor ──────────────────────────────────────────────────────────────────
async function ensureServer(skipServer) {
  try {
    await waitForUrl(`${BASE_URL}/v5/capture?preset=5&w=100&h=100`, 5000);
    return null;
  } catch {
    if (skipServer) {
      throw new Error(
        `No hay servidor en ${BASE_URL}. Corré npm run build && npm run start.`,
      );
    }
  }

  console.log("Build de producción…");
  await new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("build falló")),
    );
  });

  const port = portFromBaseUrl(BASE_URL);
  console.log(`Arrancando servidor en puerto ${port}…`);
  const child = startProductionServer(port);
  await waitForUrl(`${BASE_URL}/v5/capture?preset=5&w=100&h=100`);
  return child;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Verificar que el archivo de audio existe
  try {
    await fs.access(AUDIO_SRC);
  } catch {
    console.warn(`⚠  Audio no encontrado en ${AUDIO_SRC} — se generará video sin audio.`);
  }

  const { chromium } = await import("playwright");
  const serverProc = await ensureServer(opts.skipServer);

  const jobs = [];
  for (const formatName of opts.formats) {
    const { w, h } = FORMATS[formatName];
    for (const preset of opts.presets) {
      jobs.push({ formatName, w, h, preset });
    }
  }

  const sample = Object.values(FORMATS)[0];
  const codecLabel = CODEC === "prores" ? "ProRes 4444" : `H.264 CRF-${FFMPEG_CRF}`;
  const frameLabel = USE_PNG ? "PNG" : "JPEG-98";
  console.log(
    `Codec: ${codecLabel} · Frames: ${frameLabel} · ${QUALITY.toUpperCase()} (${sample.w}×${sample.h}) · ${CAPTURE_FPS}fps · ${jobs.length} tomas × ${DURATION_SEC}s`,
  );
  console.log(`Audio: Terminal.wav → mezclado en salida`);
  console.log(`Salida → ${OUT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
    ],
  });

  for (const { formatName, w, h, preset } of jobs) {
    const base = `v5_${formatName}_p${preset}`;
    const ext = CODEC === "prores" ? "mov" : "mp4";
    const outPath = path.join(OUT_DIR, `${base}.${ext}`);
    const framesDir = path.join(OUT_DIR, "_frames", base);
    const url =
      `${BASE_URL}/v5/capture?preset=${preset}&w=${w}&h=${h}` +
      `&frames=1&fps=${CAPTURE_FPS}`;

    console.log(`→ ${base} (${w}×${h} @ ${CAPTURE_FPS}fps) …`);

    const context = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    try {
      await recordFrames(page, url, framesDir, CAPTURE_FPS, DURATION_SEC);

      let ok = false;
      if (CODEC === "prores") {
        ok = await encodeFramesToMov(framesDir, outPath, CAPTURE_FPS);
      } else {
        ok = await encodeFramesToMp4(framesDir, outPath, CAPTURE_FPS);
      }

      await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {});

      if (ok) {
        const stat = await fs.stat(outPath);
        const probe = await probeFps(outPath);
        console.log(
          `   ✓ ${base}.${ext} (${(stat.size / 1024 / 1024).toFixed(0)} MB, ${probe} fps)`,
        );
      } else {
        console.warn(`   ✗ ffmpeg falló para ${base}`);
      }
    } catch (err) {
      console.error(`   ✗ ${base}:`, err.message || err);
      await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {});
      continue;
    } finally {
      await context.close();
    }
  }

  await browser.close();
  if (serverProc) serverProc.kill("SIGTERM");
  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
