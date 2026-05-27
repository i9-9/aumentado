import { Container } from "@/components/Container";
import { Navbar } from "@/components/Navbar";
import { Scene } from "@/components/Scene";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-12">
        <section className="relative min-h-[calc(100dvh-3rem)] overflow-hidden">
          <Scene />

          <Container className="relative z-10 flex min-h-[calc(100dvh-3rem)] items-end pb-16 sm:pb-20 lg:items-center lg:pb-24">
            <div className="pointer-events-none max-w-xl lg:max-w-md">
              <p className="type-label mb-6 text-[var(--color-muted)]">
                Estudio
              </p>
              <h1 className="type-display mb-8">Aumentado</h1>
              <p className="type-body lg:text-[1.0625rem]">
                Diseño, tecnología y experiencias digitales.
              </p>
            </div>
          </Container>
        </section>

        <section id="contacto" className="relative z-10 border-t rule bg-white">
          <Container className="py-12 lg:py-16">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-8">
              <p className="type-label text-[var(--color-muted)] sm:col-span-3">
                Contacto
              </p>
              <a
                href="mailto:hola@aumentado.com"
                className="pointer-events-auto text-base text-black underline-offset-4 hover:underline sm:col-span-9"
              >
                hola@aumentado.com
              </a>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
