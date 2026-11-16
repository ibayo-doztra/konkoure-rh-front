import type { ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

const STEP_MS = 70;
const MAX_STEPS = 5;

interface RevealProps {
  children: ReactNode;
  /** Rang de l'élément dans une grille : cascade de 70 ms, plafonnée à 5 crans. */
  index?: number;
  /** Décalage explicite en ms (prioritaire sur `index`). */
  delay?: number;
  className?: string;
  as?: "div" | "li";
}

/** Apparition douce au scroll : opacité + translation de 18px sur 400 ms. */
export function Reveal({ children, index, delay, className, as = "div" }: RevealProps) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();
  const ms = delay ?? Math.min(index ?? 0, MAX_STEPS) * STEP_MS;
  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "transition-[opacity,transform] duration-[400ms] ease-standard motion-reduce:transition-none",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0",
        className,
      )}
      style={{ transitionDelay: isVisible ? `${ms}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
