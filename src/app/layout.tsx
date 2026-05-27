import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aumentado",
  description: "Estudio creativo — diseño, tecnología y experiencias digitales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-black">
      <body className="antialiased">{children}</body>
    </html>
  );
}
