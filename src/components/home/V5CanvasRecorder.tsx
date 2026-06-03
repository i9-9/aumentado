"use client";

import { useEffect } from "react";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMime(): string {
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

type V5CanvasRecorderProps = {
  durationSec: number;
  fileName: string;
};

/**
 * Graba el canvas WebGL a alta bitrate (4K). Playwright espera el download.
 */
export function V5CanvasRecorder({
  durationSec,
  fileName,
}: V5CanvasRecorderProps) {
  useEffect(() => {
    let recorder: MediaRecorder | null = null;
    let stopped = false;

    const start = () => {
      const canvas = document.querySelector(
        "[data-v5-capture] canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas) return false;

      const stream = canvas.captureStream(60);
      const mimeType = pickMime();
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 120_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (stopped) return;
        stopped = true;
        const blob = new Blob(chunks, { type: mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName.endsWith(".webm") ? fileName : `${fileName}.webm`;
        a.click();
        URL.revokeObjectURL(a.href);
        document.body.dataset.captureDone = "true";
      };

      recorder.start(1000);
      window.setTimeout(() => {
        if (recorder?.state === "recording") recorder.stop();
      }, durationSec * 1000);

      return true;
    };

    const waitReady = window.setInterval(() => {
      if (document.body.dataset.captureReady !== "true") return;
      window.clearInterval(waitReady);
      window.setTimeout(() => {
        if (!start()) {
          document.body.dataset.captureError = "no-canvas";
        }
      }, 500);
    }, 100);

    return () => {
      window.clearInterval(waitReady);
      if (recorder?.state === "recording") recorder.stop();
    };
  }, [durationSec, fileName]);

  return null;
}
