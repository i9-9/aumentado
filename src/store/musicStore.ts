/** Ruta del tema en /public */
export const SIMULACRO_SRC = "/sgr/1 - Simulacro.wav";

/**
 * BPM del track — ajustá si la animación no calza con el pulso.
 * (Podés cambiar este valor hasta que coincida con Simulacro.)
 */
export const SIMULACRO_BPM = 128;

/** Valores del divisor BPM (mayor = animación más lenta) */
export const BPM_DIVISOR_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8] as const;

type Listener = () => void;

let audio: HTMLAudioElement | null = null;
let fallbackStart = 0;
let bpmDivisor = 1;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function ensureAudio() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(SIMULACRO_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.addEventListener("play", notify);
    audio.addEventListener("pause", notify);
    audio.addEventListener("ended", notify);
  }
  return audio;
}

/** Segundos maestro para la animación (audio si suena, si no reloj a tempo) */
export function getMusicTime(): number {
  const el = ensureAudio();
  if (el && !el.paused && el.currentTime > 0) {
    return el.currentTime;
  }
  if (fallbackStart === 0) fallbackStart = performance.now() / 1000;
  return performance.now() / 1000 - fallbackStart;
}

export function getBpmDivisor(): number {
  return bpmDivisor;
}

/** Fase en radianes: 2π por cada negra (beat), escalada por el divisor */
export function getBeatPhase(): number {
  return (
    (getMusicTime() * (SIMULACRO_BPM / 60) * Math.PI * 2) / bpmDivisor
  );
}

/** Número de beat continuo desde el inicio, escalado por el divisor */
export function getBeat(): number {
  return (getMusicTime() * (SIMULACRO_BPM / 60)) / bpmDivisor;
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

export const musicStore = {
  getAudio: () => ensureAudio(),
  getBpmDivisor: () => bpmDivisor,

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
    fallbackStart = 0;
  },
};
