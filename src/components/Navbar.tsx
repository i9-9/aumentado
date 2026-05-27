"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();
  const isV2 = pathname === "/v2";
  const contactHref = isV2 ? "/v2#contacto" : "/#contacto";

  return (
    <header className="fixed top-0 right-0 left-0 z-20">
      <nav className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
        <Link
          href={isV2 ? "/v2" : "/"}
          className="text-sm font-bold tracking-[-0.01em] text-white"
        >
          Aumentado
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-full border border-white/30 p-0.5"
            role="group"
            aria-label="Versión del sitio"
          >
            <Link
              href="/"
              className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                !isV2
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
              aria-current={!isV2 ? "page" : undefined}
            >
              01
            </Link>
            <Link
              href="/v2"
              className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                isV2
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
              aria-current={isV2 ? "page" : undefined}
            >
              02
            </Link>
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
