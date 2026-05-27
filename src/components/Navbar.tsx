import Link from "next/link";
import { Container } from "./Container";

export function Navbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-10 border-b rule bg-white">
      <Container>
        <nav className="flex h-12 items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[-0.01em]">
            Aumentado
          </Link>
          <Link
            href="#contacto"
            className="type-label text-[var(--color-muted)] hover:text-black"
          >
            Contacto
          </Link>
        </nav>
      </Container>
    </header>
  );
}
