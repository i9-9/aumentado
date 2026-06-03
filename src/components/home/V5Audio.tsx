"use client";

import { audioStore } from "@/store/audioStore";
import { musicStore } from "@/store/musicStore";
import { useEffect, useSyncExternalStore } from "react";

/** Monta Terminal y lo enlaza al mute global */
export function V5Audio() {
  const isMuted = useSyncExternalStore(
    audioStore.subscribe,
    audioStore.getMuted,
    () => true,
  );

  useEffect(() => {
    musicStore.setMuted(isMuted);
    return () => musicStore.dispose();
  }, [isMuted]);

  return null;
}
