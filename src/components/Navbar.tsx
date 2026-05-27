import Link from "next/link";

export function Navbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-20">
      <nav className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
        <Link
          href="/"
          className="text-sm font-bold tracking-[-0.01em] text-white"
        >
          Aumentado
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="#contacto"
            className="rounded-full border border-white/30 px-5 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:border-white hover:bg-white/10"
          >
            Contacto
          </Link>
        </div>
      </nav>
    </header>
  );
}
