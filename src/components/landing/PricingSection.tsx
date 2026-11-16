import { useState } from "react";
import { Reveal } from "./primitives/Reveal";
import { Section, SectionHeading } from "./primitives/Section";
import { PricingCard, type BillingCycle } from "./PricingCard";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { cn } from "@/lib/utils";

function BillingToggle({
  cycle,
  onChange,
  monthlyLabel,
  annualLabel,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  monthlyLabel: string;
  annualLabel: string;
}) {
  const pill = (active: boolean) =>
    cn(
      "h-[38px] rounded-full px-4 text-[13px] font-medium transition-colors duration-150",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div role="group" className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
      <button
        type="button"
        className={pill(cycle === "monthly")}
        aria-pressed={cycle === "monthly"}
        onClick={() => onChange("monthly")}
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        className={pill(cycle === "annual")}
        aria-pressed={cycle === "annual"}
        onClick={() => onChange("annual")}
      >
        {annualLabel}
      </button>
    </div>
  );
}

export function PricingSection() {
  const { copy } = useLandingCopy();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const p = copy.pricing;

  return (
    <Section id="tarifs">
      <SectionHeading align="center" eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />

      <Reveal className="mt-6 text-center">
        <BillingToggle
          cycle={cycle}
          onChange={setCycle}
          monthlyLabel={p.monthly}
          annualLabel={p.annual}
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] items-start gap-[18px]">
        {p.plans.map((plan, i) => (
          <Reveal key={plan.id} index={i} className="h-full">
            <PricingCard plan={plan} cycle={cycle} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        {p.notes.map((n) => (
          <p
            key={n}
            className="rounded-md bg-accent px-4 py-3.5 text-xs font-medium text-primary-strong"
          >
            {n}
          </p>
        ))}
      </Reveal>

    </Section>
  );
}
