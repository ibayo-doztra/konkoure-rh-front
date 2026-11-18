import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ANNUAL_FACTOR, PLAN_MONTHLY_PRICE, type PlanCopy } from "@/lib/landing/copy";
import { formatGnf, useLandingCopy } from "@/lib/landing/useLandingCopy";
import { cn } from "@/lib/utils";
import { savePendingPlan, type PendingPlanCode } from "@/lib/pending-plan";

const PLAN_CODE_BY_ID: Partial<Record<PlanCopy["id"], PendingPlanCode>> = {
  essential: "starter",
  pro: "pro",
  enterprise: "enterprise",
};

export type BillingCycle = "monthly" | "annual";

export const getDisplayedMonthlyPrice = (monthly: number, cycle: BillingCycle): number =>
  cycle === "annual" ? monthly * ANNUAL_FACTOR : monthly;

interface PricingCardProps {
  plan: PlanCopy;
  cycle: BillingCycle;
}

export function PricingCard({ plan, cycle }: PricingCardProps) {
  const { copy } = useLandingCopy();
  const p = copy.pricing;
  const featured = !!plan.popular;
  const monthly = PLAN_MONTHLY_PRICE[plan.id];
  const price = formatGnf(getDisplayedMonthlyPrice(monthly, cycle));
  const billingNote = cycle === "annual" ? p.billedAnnually : p.billedMonthly;

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-xl border bg-card p-5 shadow-card",
        featured && "border-primary shadow-featured",
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-[22px] rounded-full bg-primary px-3 py-[3px] text-[10px] font-bold text-primary-foreground">
          {p.popularLabel}
        </span>
      )}

      <h3
        className={cn(
          "text-base font-bold tracking-[-0.01em]",
          featured && "text-primary-strong",
        )}
      >
        {plan.name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{plan.seats}</p>

      <p className="mt-4 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[26px] font-black leading-none tabular-nums">{price}</span>
        <span className="text-[13px] font-medium text-muted-foreground">{p.perMonth}</span>
      </p>
      {monthly > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">{billingNote}</p>}

      <p className="mt-3 text-sm text-muted-foreground">{plan.pitch}</p>

      <Button
        asChild
        variant={featured ? "default" : "outline"}
        className={cn("mt-4 h-11 w-full rounded-md font-medium", featured && "shadow-cta")}
      >
        {PLAN_CODE_BY_ID[plan.id] ? (
          <Link
            to="/paiement"
            search={{
              plan: PLAN_CODE_BY_ID[plan.id]!,
              cycle: cycle === "annual" ? "annuel" : "mensuel",
            }}
            onClick={() => {
              const code = PLAN_CODE_BY_ID[plan.id];
              if (code) savePendingPlan({ plan: code, cycle: cycle === "annual" ? "annuel" : "mensuel" });
            }}
          >
            {plan.cta}
          </Link>
        ) : (
          <Link to="/signup">{plan.cta}</Link>
        )}
      </Button>

      <div className="mt-[18px] border-t pt-[18px]">
        <p className="text-xs font-bold text-muted-foreground">{plan.includedLabel}</p>
        <ul className="mt-3 space-y-2.5 text-sm">
          {plan.features.map((f) => (
            <li key={f.title} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <strong className="font-bold">{f.title}</strong>
                {" — "}
                <span className="text-muted-foreground whitespace-pre-line">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
