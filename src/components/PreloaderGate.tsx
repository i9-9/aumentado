"use client";

import { type ReactNode, useState } from "react";
import { Preloader } from "./Preloader";

type PreloaderGateProps = {
  children: ReactNode;
};

export function PreloaderGate({ children }: PreloaderGateProps) {
  const [ready, setReady] = useState(false);

  return (
    <>
      {!ready && <Preloader onComplete={() => setReady(true)} />}
      <div
        className={`transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}
