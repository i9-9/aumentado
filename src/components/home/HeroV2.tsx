import { SceneV2 } from "@/components/SceneV2";

export function HeroV2() {
  return (
    <section className="relative h-[100dvh] overflow-hidden">
      <SceneV2 key="hero-v2-3d" />

      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-end">
        <h1 className="type-hero px-6 pb-10 sm:px-10 sm:pb-12 lg:px-12 lg:pb-14">
          Aumentado
        </h1>
        <p className="type-hint absolute right-6 bottom-8 sm:right-10 lg:right-12">
          Scroll para explorar
        </p>
      </div>
    </section>
  );
}
