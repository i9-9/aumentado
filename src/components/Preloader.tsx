"use client";

import { useEffect, useRef, useState } from "react";

const MIN_MS = 1600;
const COUNTER_MS = 2400;

type PreloaderProps = {
  onComplete: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const [value, setValue] = useState(0);
  const [exiting, setExiting] = useState(false);
  const completed = useRef(false);
  const gates = useRef({ counter: false, min: false, load: false });

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const tryFinish = () => {
      const { counter, min, load } = gates.current;
      if (!counter || !min || !load || completed.current) return;

      completed.current = true;
      setValue(100);
      setExiting(true);
      window.setTimeout(() => {
        document.body.style.overflow = "";
        onComplete();
      }, 500);
    };

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNTER_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.min(100, Math.floor(eased * 100)));

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        gates.current.counter = true;
        tryFinish();
      }
    };

    raf = requestAnimationFrame(tick);

    const minTimer = window.setTimeout(() => {
      gates.current.min = true;
      tryFinish();
    }, MIN_MS);

    if (document.readyState === "complete") {
      gates.current.load = true;
      tryFinish();
    } else {
      const onLoad = () => {
        gates.current.load = true;
        tryFinish();
      };
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(minTimer);
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={!exiting}
      aria-label={`Cargando: aumentando, ${value} por ciento`}
    >
      <p className="type-preloader-word text-black">aumentando</p>
      <p className="type-counter mt-6 tabular-nums text-black/40">
        {String(value).padStart(3, "0")}
      </p>
      <div className="absolute right-0 bottom-0 left-0 h-px bg-black/10">
        <div
          className="h-px bg-black transition-[width] duration-75 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
