import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Reveal } from "./primitives/Reveal";
import { Section } from "./primitives/Section";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";

export function FinalCtaSection() {
  const { copy } = useLandingCopy();

  return (
    <Section>
      <Reveal>
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-strong px-7 py-11 text-center shadow-final-cta">
          <h2 className="mx-auto max-w-[26ch] text-[26px] font-black leading-tight tracking-[-0.01em] text-primary-foreground">
            {copy.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-[54ch] text-sm text-primary-foreground/90">
            {copy.cta.desc}
          </p>
          <Button
            asChild
            className="mt-6 h-12 rounded-md bg-card px-[26px] font-bold text-primary-strong transition-transform hover:-translate-y-0.5 hover:bg-card/90"
          >
            <Link to="/signup">{copy.cta.button}</Link>
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
