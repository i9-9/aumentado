"use client";

import { advanceCaptureFrame } from "@/store/musicStore";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

declare global {
  interface Window {
    __v5CaptureStep?: () => void;
  }
}

/** Un paso = avanzar reloj + un render (para captura frame-by-frame) */
export function V5FrameStepBridge() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    window.__v5CaptureStep = () => {
      advanceCaptureFrame();
      invalidate();
    };
    invalidate();
    const t = window.setTimeout(() => {
      document.body.dataset.captureReady = "true";
    }, 500);
    return () => {
      window.clearTimeout(t);
      delete window.__v5CaptureStep;
    };
  }, [invalidate]);

  return null;
}
