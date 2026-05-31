"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { audioStore } from "@/store/audioStore";

function SpeakerIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isV2 = pathname === "/v2";
  const isV3 = pathname === "/v3";
  const activeVersion = isV2 ? "/v2" : isV3 ? "/v3" : "/";
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
          {isV2 && (
            <button
              onClick={audioStore.toggle}
              title={isMuted ? "Activar audio" : "Silenciar"}
              className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:border-white hover:bg-white/10"
            >
              <SpeakerIcon muted={isMuted} />
              <span className="hidden sm:inline">{isMuted ? "Audio" : "Mute"}</span>
            </button>
          )}

          <div
            className="flex rounded-full border border-white/30 p-0.5"
            role="group"
            aria-label="Versión del sitio"
          >
            {(["01", "02", "03"] as const).map((label) => {
              const href = label === "01" ? "/" : `/${label === "02" ? "v2" : "v3"}`;
              const active = label === "01" ? (!isV2 && !isV3) : label === "02" ? isV2 : isV3;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                    active ? "bg-white text-black" : "text-white/60 hover:text-white"
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
