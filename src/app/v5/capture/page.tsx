import { V5Capture } from "@/components/home/V5Capture";
import { Suspense } from "react";

export const metadata = {
  title: "V5 Capture — Aumentado",
  robots: "noindex",
};

export default function V5CapturePage() {
  return (
    <Suspense fallback={<main className="h-screen bg-black" />}>
      <V5Capture />
    </Suspense>
  );
}
