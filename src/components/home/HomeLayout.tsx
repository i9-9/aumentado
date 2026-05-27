import { Navbar } from "@/components/Navbar";
import { PreloaderGate } from "@/components/PreloaderGate";
import type { ReactNode } from "react";

type HomeLayoutProps = {
  hero: ReactNode;
};

export function HomeLayout({ hero }: HomeLayoutProps) {
  return (
    <PreloaderGate>
      <Navbar />
      <main className="bg-black text-white">
        {hero}

        <section
          id="contacto"
          className="relative z-10 border-t border-white/10 px-6 py-20 sm:px-10 lg:px-12"
        >
          <p className="type-hint mb-4 text-white/40">Contacto</p>
          <a
            href="mailto:hola@aumentado.com"
            className="text-2xl font-bold tracking-[-0.02em] text-white transition-opacity hover:opacity-60 sm:text-3xl"
          >
            hola@aumentado.com
          </a>
        </section>
      </main>
    </PreloaderGate>
  );
}
