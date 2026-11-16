import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./primitives/Reveal";
import { Section, SectionHeading } from "./primitives/Section";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";

export function FaqSection() {
  const { copy } = useLandingCopy();

  return (
    <Section id="faq">
      <div className="mx-auto max-w-[820px]">
        <SectionHeading eyebrow={copy.faq.eyebrow} title={copy.faq.title} />
        <Reveal className="mt-6">
          <Accordion
            type="multiple"
            className="overflow-hidden rounded-lg border bg-card shadow-card"
          >
            {copy.faq.items.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`} className="border-border">
                <AccordionTrigger className="px-5 py-[18px] hover:bg-background hover:no-underline [&>svg]:text-primary">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="max-w-[72ch] px-5 pb-[18px] text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}
