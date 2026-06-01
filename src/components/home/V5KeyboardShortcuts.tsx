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

/** Atajos v5: teclas 1–9 → velocidad BPM (divisor) */
export function V5KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return;

      const match = e.code.match(/^Digit([1-9])$/);
      if (!match) return;

      e.preventDefault();
      musicStore.setBpmDivisorByDigit(Number(match[1]));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
