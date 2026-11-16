import { useCountUp } from "@/hooks/useCountUp";
import { useReveal } from "@/hooks/useReveal";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { Section } from "./primitives/Section";

/** Compteur animé, déclenché à l'entrée du bandeau dans le viewport. */
function Counter({ value, suffix, active }: { value: number; suffix?: string; active: boolean }) {
  const display = useCountUp(value, { active });
  return (
    <span className="tabular-nums">
      {display}
      {suffix ?? ""}
    </span>
  );
}

export function TrustBandSection() {
  const { copy } = useLandingCopy();
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <Section>
      <div
        ref={ref}
        className="rounded-2xl border bg-card p-6 shadow-card transition-[opacity,transform] duration-[400ms] ease-standard motion-reduce:transition-none md:px-6 md:py-7"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "none" : "translateY(18px)" }}
      >
        <p className="mx-auto max-w-[34ch] text-center text-xl font-bold leading-snug tracking-[-0.01em]">
          {copy.stats.title}
        </p>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
          {copy.stats.items.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-[28px] font-black leading-none text-primary-strong">
                <Counter value={s.value} suffix={s.suffix} active={isVisible} />
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
