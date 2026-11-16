import { FeatureIcon } from "./primitives/FeatureIcon";
import { Reveal } from "./primitives/Reveal";
import { Section, SectionHeading } from "./primitives/Section";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";

export function BenefitsSection() {
  const { copy } = useLandingCopy();

  return (
    <Section id="benefices">
      <SectionHeading
        eyebrow={copy.benefits.eyebrow}
        title={copy.benefits.title}
        subtitle={copy.benefits.subtitle}
      />
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
        {copy.benefits.items.map((item, i) => (
          <Reveal key={item.title} index={i} className="h-full">
            <article className="h-full rounded-lg border bg-card p-5 shadow-card transition-all duration-200 ease-standard hover:-translate-y-1 hover:shadow-hover">
              <FeatureIcon name={item.icon} />
              <h3 className="mt-4 text-base font-bold tracking-[-0.01em]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
