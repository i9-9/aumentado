"use client";

import { musicStore } from "@/store/musicStore";
import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Atajos v5: 1–9 BPM · H ocultar UI · F pantalla completa */
export function V5KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return;

      const match = e.code.match(/^Digit([1-9])$/);
      if (match) {
        e.preventDefault();
        musicStore.setBpmDivisorByDigit(Number(match[1]));
        return;
      }

      if (e.code === "KeyH") {
        e.preventDefault();
        document.documentElement.classList.toggle("v5-ui-hidden");
        return;
      }

      if (e.code === "KeyF") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      if (e.code === "KeyR") {
        e.preventDefault();
        void musicStore.restart();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
