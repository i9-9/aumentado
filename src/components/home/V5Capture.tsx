"use client";

import {
  BPM_DIVISOR_PRESETS,
  configureCapture,
  exitCapture,
} from "@/store/musicStore";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { HeroV5 } from "./HeroV5";

/** 4K UHD — video principal y teasers verticales */
export const V5_CAPTURE_FORMATS = {
  landscape: { w: 3840, h: 2160, label: "landscape" },
  portrait: { w: 2160, h: 3840, label: "portrait" },
} as const;

export const V5_CAPTURE_FORMATS_1080 = {
  landscape: { w: 1920, h: 1080, label: "landscape" },
  portrait: { w: 1080, h: 1920, label: "portrait" },
} as const;

function parseDivisor(
  divisorParam: string | null,
  presetParam: string | null,
): number {
  if (presetParam) {
    const digit = Number(presetParam);
    if (digit >= 1 && digit <= BPM_DIVISOR_PRESETS.length) {
      return BPM_DIVISOR_PRESETS[BPM_DIVISOR_PRESETS.length - digit];
    }
  }
  if (divisorParam) {
    const n = Number(divisorParam);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 1;
}

export function V5Capture() {
  const params = useSearchParams();

  const w = Math.max(320, Number(params.get("w")) || V5_CAPTURE_FORMATS.landscape.w);
  const h = Math.max(320, Number(params.get("h")) || V5_CAPTURE_FORMATS.landscape.h);
  const divisor = useMemo(
    () => parseDivisor(params.get("divisor"), params.get("preset")),
    [params],
  );
  const frameCapture = params.get("frames") === "1";
  const captureFps = Math.max(
    24,
    Math.min(60, Number(params.get("fps")) || 60),
  );

  useEffect(() => {
    delete document.body.dataset.captureReady;
    delete document.body.dataset.captureDone;
    delete document.body.dataset.captureError;
    configureCapture(divisor, {
      frameClock: frameCapture,
      fps: captureFps,
    });
    return () => {
      delete document.body.dataset.captureReady;
      delete document.body.dataset.captureDone;
      delete document.body.dataset.captureError;
      exitCapture();
    };
  }, [divisor, frameCapture, captureFps]);

  return (
    <main
      className="overflow-hidden bg-black"
      style={{ width: w, height: h, margin: 0 }}
      data-v5-capture-root
    >
      <HeroV5 capture frameCapture={frameCapture} width={w} height={h} />
    </main>
  );
}

/** Etiqueta de archivo: preset 3 → p3, divisor 1.5 → div1p5 */
export function captureFileSuffix(
  preset: number | null,
  divisor: number,
): string {
  if (preset != null && preset >= 1 && preset <= 9) {
    return `p${preset}`;
  }
  return `div${String(divisor).replace(".", "p")}`;
}

export function presetForDivisor(divisor: number): number {
  const idx = BPM_DIVISOR_PRESETS.findIndex((p) => p === divisor);
  if (idx < 0) return 0;
  return BPM_DIVISOR_PRESETS.length - idx;
}

export function getCaptureDivisor(preset: number): number {
  return BPM_DIVISOR_PRESETS[BPM_DIVISOR_PRESETS.length - preset];
}
