"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { audioStore } from "@/store/audioStore";
import { BPM_DIVISOR_PRESETS, musicStore } from "@/store/musicStore";

const VERSIONS = ["01", "02", "03", "04", "05", "07"] as const;

function versionHref(label: (typeof VERSIONS)[number]) {
  if (label === "01") return "/";
  if (label === "02") return "/v2";
  if (label === "03") return "/v3";
  if (label === "04") return "/v4";
  if (label === "05") return "/v5";
  return "/v7";
}

function isActivePath(
  pathname: string,
  label: (typeof VERSIONS)[number],
): boolean {
  if (label === "01") return pathname === "/";
  return pathname === versionHref(label);
}

function activeVersionPath(pathname: string) {
  if (pathname === "/v2") return "/v2";
  if (pathname === "/v3") return "/v3";
  if (pathname === "/v4") return "/v4";
  if (pathname === "/v5") return "/v5";
  if (pathname === "/v7") return "/v7";
  return "/";
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function formatBpmDivisor(value: number): string {
  if (value >= 1) return `÷${value}`;
  const inv = 1 / value;
  return Number.isInteger(inv) ? `×${inv}` : `÷${value}`;
}

function BpmDivisorControl() {
  const divisor = useSyncExternalStore(
    musicStore.subscribe,
    musicStore.getBpmDivisor,
    () => 1,
  );

  const atMin = divisor <= BPM_DIVISOR_PRESETS[0];
  const atMax = divisor >= BPM_DIVISOR_PRESETS[BPM_DIVISOR_PRESETS.length - 1];

  return (
    <div
      className="flex items-center rounded-full border border-white/30"
      role="group"
      aria-label="Divisor BPM de la animación"
    >
      <button
        type="button"
        onClick={() => musicStore.stepBpmDivisor(-1)}
        disabled={atMin}
        title="Animación más rápida"
        className="px-2.5 py-2 text-xs text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Reducir divisor BPM"
      >
        −
      </button>
      <span
        className="min-w-[2.75rem] border-x border-white/20 px-2 py-2 text-center font-mono text-[10px] tracking-wide text-white/90"
        title="Divisor BPM: mayor = más lento"
      >
        {formatBpmDivisor(divisor)}
      </span>
      <button
        type="button"
        onClick={() => musicStore.stepBpmDivisor(1)}
        disabled={atMax}
        title="Animación más lenta"
        className="px-2.5 py-2 text-xs text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Aumentar divisor BPM"
      >
        +
      </button>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isV2 = pathname === "/v2";
  const isV5 = pathname === "/v5";
  const showAudio = isV2 || isV5;
  const activeVersion = activeVersionPath(pathname);
  const contactHref = `${activeVersion === "/" ? "" : activeVersion}#contacto`;

  const isMuted = useSyncExternalStore(
    audioStore.subscribe,
    audioStore.getMuted,
    () => true,
  );

  return (
    <header className="fixed top-0 right-0 left-0 z-20">
      <nav className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
        <Link
          href={activeVersion}
          className="text-sm font-bold tracking-[-0.01em] text-white"
        >
          Aumentado
        </Link>

        <div className="flex items-center gap-3">
          {isV5 && <BpmDivisorControl />}

          {showAudio && (
            <button
              onClick={audioStore.toggle}
              title={isMuted ? "Activar audio" : "Silenciar"}
              className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:border-white hover:bg-white/10"
            >
              <SpeakerIcon muted={isMuted} />
              <span className="hidden sm:inline">
                {isMuted ? "Audio" : "Mute"}
              </span>
            </button>
          )}

          <div
            className="flex rounded-full border border-white/30 p-0.5"
            role="group"
            aria-label="Versión del sitio"
          >
            {VERSIONS.map((label) => {
              const active = isActivePath(pathname, label);
              return (
                <Link
                  key={label}
                  href={versionHref(label)}
                  className={`rounded-full px-2.5 py-1.5 text-xs font-medium tracking-wide transition-colors sm:px-3 ${
                    active
                      ? "bg-white text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <Link
            href={contactHref}
            className="rounded-full border border-white/30 px-5 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:border-white hover:bg-white/10"
          >
            Contacto
          </Link>
        </div>
      </nav>
    </header>
  );
}
