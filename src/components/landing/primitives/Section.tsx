import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface SectionProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Conteneur de section : largeur, gouttières et rythme vertical homogènes. */
export function Section({ id, className, children }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-10 md:py-14", className)}>
      <div className="mx-auto w-full max-w-[1160px] px-5">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

/** En-tête de section : sur-titre, titre et accroche. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        align === "center" ? "mx-auto max-w-[56ch] text-center" : "max-w-[56ch] text-left",
        className,
      )}
    >
      {eyebrow && <p className="text-xs font-medium text-primary-strong">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.01em]">{title}</h2>
      {subtitle && <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>}
    </Reveal>
  );
}
