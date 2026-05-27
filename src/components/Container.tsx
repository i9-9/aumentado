import { type ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-5xl px-6 sm:max-w-6xl sm:px-8 lg:max-w-7xl lg:px-10 xl:max-w-[90rem] xl:px-12 2xl:max-w-[110rem] 2xl:px-16 ${className}`}
    >
      {children}
    </div>
  );
}
