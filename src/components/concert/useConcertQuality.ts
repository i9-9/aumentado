"use client";

import { useEffect, useState } from "react";

export type ConcertQuality = "low" | "medium" | "high";

export type ConcertQualitySettings = {
  crowdRows: number;
  shadowMapSize: number;
  bloomIntensity: number;
  dprMax: number;
  enableBloom: boolean;
};

const SETTINGS: Record<ConcertQuality, ConcertQualitySettings> = {
  low: {
    crowdRows: 3,
    shadowMapSize: 512,
    bloomIntensity: 0.55,
    dprMax: 1,
    enableBloom: true,
  },
  medium: {
    crowdRows: 4,
    shadowMapSize: 768,
    bloomIntensity: 0.75,
    dprMax: 1.25,
    enableBloom: true,
  },
  high: {
    crowdRows: 5,
    shadowMapSize: 1024,
    bloomIntensity: 0.9,
    dprMax: 1.5,
    enableBloom: true,
  },
};

function detectQuality(): ConcertQuality {
  if (typeof window === "undefined") return "high";
  const w = window.innerWidth;
  if (w < 640) return "low";
  if (w < 1024) return "medium";
  return "high";
}

export function useConcertQuality() {
  const [quality, setQuality] = useState<ConcertQuality>("high");

  useEffect(() => {
    const update = () => setQuality(detectQuality());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { quality, settings: SETTINGS[quality] };
}
