/** Tema v5 — clips y preview sincronizados a Terminal para editar después */
export const V5_TRACK_SRC = "/sgr/3 - Terminal.wav";

/** BPM de Terminal */
export const V5_TRACK_BPM = 114;

/** Valores del divisor BPM (mayor = animación más lenta) */
export const BPM_DIVISOR_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8] as const;

type Listener = () => void;

let audio: HTMLAudioElement | null = null;
let fallbackStart = 0;
let bpmDivisor = 1;
let captureMode = false;
/** Captura cuadro a cuadro: animación a FPS fijo aunque el GPU vaya lento */
let captureFrameClock = false;
let captureFrameIndex = 0;
let captureFps = 60;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function ensureAudio() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(V5_TRACK_SRC);
    audio.loop = !captureMode;
    audio.preload = "auto";
    audio.addEventListener("play", notify);
    audio.addEventListener("pause", notify);
    audio.addEventListener("ended", notify);
  }
  return audio;
}

/** Segundos maestro para la animación (audio si suena, si no reloj a tempo) */
export function getMusicTime(): number {
  if (captureFrameClock) {
    return captureFrameIndex / captureFps;
  }
  if (captureMode) {
    if (fallbackStart === 0) fallbackStart = performance.now() / 1000;
    return performance.now() / 1000 - fallbackStart;
  }
  const el = ensureAudio();
  if (el && !el.paused && el.currentTime > 0) {
    return el.currentTime;
  }
  if (fallbackStart === 0) fallbackStart = performance.now() / 1000;
  return performance.now() / 1000 - fallbackStart;
}

export function isCaptureMode(): boolean {
  return captureMode;
}

export function getBpmDivisor(): number {
  return bpmDivisor;
}

/** Fase en radianes: 2π por cada negra (beat), escalada por el divisor */
export function getBeatPhase(): number {
  return (
    (getMusicTime() * (V5_TRACK_BPM / 60) * Math.PI * 2) / bpmDivisor
  );
}

/** Número de beat continuo desde el inicio, escalado por el divisor */
export function getBeat(): number {
  return (getMusicTime() * (V5_TRACK_BPM / 60)) / bpmDivisor;
}

function nearestPresetIndex(value: number): number {
  let best = 0;
  let bestDist = Infinity;
  BPM_DIVISOR_PRESETS.forEach((p, i) => {
    const d = Math.abs(p - value);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export type CaptureOptions = {
  /** Reloj por frame (60 fps reales en el mp4) */
  frameClock?: boolean;
  fps?: number;
};

/** Reloj desde t=0, sin audio — para grabar tomas alineables en el editor */
export function configureCapture(divisor: number, options: CaptureOptions = {}) {
  captureMode = true;
  captureFrameClock = options.frameClock ?? false;
  captureFps = options.fps ?? 60;
  captureFrameIndex = 0;
  const idx = nearestPresetIndex(divisor);
  bpmDivisor = BPM_DIVISOR_PRESETS[idx];
  if (audio) {
    audio.loop = false;
    audio.pause();
    audio.currentTime = 0;
  }
  fallbackStart = performance.now() / 1000;
  notify();
}

export function advanceCaptureFrame(): void {
  captureFrameIndex += 1;
}

export function exitCapture() {
  captureMode = false;
  captureFrameClock = false;
  captureFrameIndex = 0;
  if (audio) audio.loop = true;
  fallbackStart = 0;
  notify();
}

export const musicStore = {
  getAudio: () => ensureAudio(),
  getBpmDivisor: () => bpmDivisor,
  isCaptureMode,
  configureCapture,
  exitCapture,

  setBpmDivisor(value: number) {
    const idx = nearestPresetIndex(value);
    bpmDivisor = BPM_DIVISOR_PRESETS[idx];
    notify();
  },

  /** Atajo teclado 1–9: 1 = más lento (÷8), 9 = más rápido (×4) */
  setBpmDivisorByDigit(digit: number) {
    if (digit < 1 || digit > BPM_DIVISOR_PRESETS.length) return;
    const idx = BPM_DIVISOR_PRESETS.length - digit;
    bpmDivisor = BPM_DIVISOR_PRESETS[idx];
    notify();
  },

  stepBpmDivisor(delta: -1 | 1) {
    const idx = nearestPresetIndex(bpmDivisor);
    const next = Math.max(
      0,
      Math.min(BPM_DIVISOR_PRESETS.length - 1, idx + delta),
    );
    bpmDivisor = BPM_DIVISOR_PRESETS[next];
    notify();
  },

  async play() {
    const el = ensureAudio();
    if (!el) return;
    fallbackStart = performance.now() / 1000 - el.currentTime;
    try {
      await el.play();
    } catch {
      /* autoplay bloqueado hasta interacción */
    }
    notify();
  },

  async restart() {
    const el = ensureAudio();
    if (!el) return;
    el.currentTime = 0;
    fallbackStart = performance.now() / 1000;
    try {
      await el.play();
    } catch {
      /* autoplay bloqueado hasta interacción */
    }
    notify();
  },

  pause() {
    audio?.pause();
    notify();
  },

  setMuted(muted: boolean) {
    const el = ensureAudio();
    if (!el) return;
    if (muted) {
      el.pause();
    } else {
      void musicStore.play();
    }
    notify();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  dispose() {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    captureMode = false;
    captureFrameClock = false;
    captureFrameIndex = 0;
    fallbackStart = 0;
  },
};
