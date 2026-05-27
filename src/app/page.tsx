import { Navbar } from "@/components/Navbar";
import { Scene } from "@/components/Scene";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="bg-black text-white">
        <section className="relative h-[100dvh] overflow-hidden">
          <Scene />

          <div className="pointer-events-none relative z-10 flex h-full flex-col justify-end">
            <h1 className="type-hero px-6 pb-10 sm:px-10 sm:pb-12 lg:px-12 lg:pb-14">
              Aumentado
            </h1>
            <p className="type-hint absolute right-6 bottom-8 sm:right-10 lg:right-12">
              Scroll para explorar
            </p>
          </div>
        </section>

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
    </>
  );
}
