"use client";

import { getBeat, getBeatPhase, getMusicTime, musicStore } from "@/store/musicStore";
import { useSyncExternalStore } from "react";

export function useBeatClock() {
  useSyncExternalStore(musicStore.subscribe, () => musicStore.getAudio()?.paused ?? true);

  return {
    t: getMusicTime(),
    beat: getBeat(),
    beatPhase: getBeatPhase(),
  };
}
