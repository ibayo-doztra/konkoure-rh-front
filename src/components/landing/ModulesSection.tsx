import { FeatureIcon } from "./primitives/FeatureIcon";
import { Reveal } from "./primitives/Reveal";
import { Section, SectionHeading } from "./primitives/Section";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";

export function ModulesSection() {
  const { copy } = useLandingCopy();

  return (
    <Section id="modules">
      <SectionHeading
        eyebrow={copy.modules.eyebrow}
        title={copy.modules.title}
        subtitle={copy.modules.subtitle}
      />
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        {copy.modules.items.map((item, i) => (
          <Reveal key={item.title} index={i} className="h-full">
            <article className="h-full rounded-lg border bg-card p-[22px] shadow-card transition-all duration-200 ease-standard hover:-translate-y-1 hover:shadow-hover">
              <div className="flex items-center gap-3">
                <FeatureIcon name={item.icon} className="h-10 w-10" />
                <h3 className="min-w-0 text-base font-bold tracking-[-0.01em]">{item.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
