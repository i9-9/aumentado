import { ConcertStage } from "@/components/concert/ConcertStage";

export function HeroV2() {
  return (
    <section className="relative h-[100dvh] overflow-hidden bg-[#020108]">
      <ConcertStage key="hero-v2-stage" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-between px-6 pb-8 sm:px-10 lg:px-12">
        <p className="type-hint text-white/40">
          Arrastrá para orbitar · scroll para zoom
        </p>
      </div>
    </section>
  );
}
