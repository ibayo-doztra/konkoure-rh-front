// Éléments partagés entre la page de paiement interne (/app/billing/checkout)
// et la page de paiement publique (/paiement).
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BillingCycle, PaymentMethod, Plan } from "@/lib/api/billing";

/** Cycle as written in the URLs (`?cycle=annuel`), kept for existing links. */
export type SearchCycle = "mensuel" | "annuel";
export type Cycle = BillingCycle;
export type PlanCode = "starter" | "pro" | "enterprise";
export type Method = PaymentMethod;

export const PLAN_CODES: PlanCode[] = ["starter", "pro", "enterprise"];

export const cycleFromSearch = (value: SearchCycle): Cycle =>
  value === "annuel" ? "yearly" : "monthly";
export const cycleToSearch = (value: Cycle): SearchCycle =>
  value === "yearly" ? "annuel" : "mensuel";

export type PlanRow = Plan;

export function useMethods(): { value: Method; label: string; hint: string }[] {
  const { t } = useTranslation();
  return [
    {
      value: "orange_money",
      label: t("checkout.methodOrangeMoney"),
      hint: t("checkout.methodMobileHint"),
    },
    { value: "mtn_momo", label: t("checkout.methodMtnMomo"), hint: t("checkout.methodMobileHint") },
    { value: "card", label: t("checkout.methodCard"), hint: t("checkout.methodCardHint") },
  ];
}

export const gnf = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.round(v))
    .replace(/\u202f|\u00a0/g, " ");

export const digits = (v: string) => v.replace(/\D/g, "");

export const isValidGnPhone = (v: string) => {
  const d = digits(v).replace(/^224/, "");
  return d.length === 9 && d.startsWith("6");
};

export function PlanPicker({
  plans,
  planCode,
  onSelect,
}: {
  plans: PlanRow[];
  planCode: PlanCode;
  onSelect: (code: PlanCode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {plans
        .filter((p) => p.priceMonthlyGnf > 0)
        .map((p) => {
          const active = p.code === planCode;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.code as PlanCode)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-accent/40"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              <span className="block text-sm font-semibold text-foreground">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {t("checkout.upToEmployees", { count: p.maxEmployees })}
              </span>
            </button>
          );
        })}
    </div>
  );
}

export function CyclePicker({ cycle, onSelect }: { cycle: Cycle; onSelect: (c: Cycle) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={cycle === "monthly" ? "default" : "outline"}
        onClick={() => onSelect("monthly")}
      >
        {t("checkout.cycleMonthly")}
      </Button>
      <Button
        size="sm"
        variant={cycle === "yearly" ? "default" : "outline"}
        onClick={() => onSelect("yearly")}
      >
        {t("checkout.cycleYearly")}
      </Button>
      {cycle === "yearly" && <Badge variant="success">{t("checkout.twoMonthsFree")}</Badge>}
    </div>
  );
}

export function AmountSummary({
  amount,
  planName,
  cycle,
}: {
  amount: number;
  planName: string | null;
  cycle: Cycle;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{t("checkout.amountToPay")}</p>
      <p className="text-2xl font-black tabular-nums">
        {gnf(amount)} <span className="text-sm font-medium text-muted-foreground">GNF</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {t("checkout.offerBilling", {
          plan: planName ?? "—",
          cycle: cycle === "yearly" ? t("checkout.billingYearly") : t("checkout.billingMonthly"),
        })}
      </p>
    </div>
  );
}

export function MethodPicker({ onSelect }: { onSelect: (m: Method) => void }) {
  const { t } = useTranslation();
  const METHODS = useMethods();
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t("checkout.chooseMethod")}</p>
      <div className="grid gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onSelect(m.value)}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">{m.label}</span>
              <span className="block text-xs text-muted-foreground">{m.hint}</span>
            </span>
            {m.value === "card" ? (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectedMethodBar({ method, onChange }: { method: Method; onChange: () => void }) {
  const { t } = useTranslation();
  const METHODS = useMethods();
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary bg-accent/40 px-4 py-3">
      <span className="text-sm font-semibold">
        {METHODS.find((m) => m.value === method)?.label}
      </span>
      <Button variant="ghost" size="sm" onClick={onChange}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("checkout.change")}
      </Button>
    </div>
  );
}
