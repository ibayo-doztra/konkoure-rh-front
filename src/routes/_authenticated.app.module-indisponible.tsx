import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Lock, ArrowRight } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { useSubscription } from "@/hooks/useSubscription";
import {
  MODULE_LABELS,
  PLAN_LABELS,
  PLAN_MODULES,
  requiredPlanFor,
  type ModuleKey,
} from "@/lib/entitlements";

const searchSchema = z.object({ module: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/module-indisponible")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: ModuleLockedPage,
  head: () => ({
    meta: [
      { title: "Module non inclus — Konkouré RH" },
      {
        name: "description",
        content: "Ce module n'est pas inclus dans l'offre actuelle de votre organisation.",
      },
    ],
  }),
});

function ModuleLockedPage() {
  const { t } = useTranslation();
  const { module } = useSearch({ from: "/_authenticated/app/module-indisponible" });
  const { subscription } = useSubscription();
  const key = (module ?? "") as ModuleKey;
  const label = MODULE_LABELS[key] ?? t("onboarding.defaultModule");
  const needed = requiredPlanFor(key);
  const unlocked = (PLAN_MODULES[needed] ?? []).filter((m) => !subscription.modules.includes(m));

  return (
    <div className="space-y-6">
      <PageHeader title={t("onboarding.moduleLockedTitle")} description={t("onboarding.moduleLockedDescription")} />
      <Card className="max-w-2xl">
        <CardHeader className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
            <Lock className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{t("onboarding.moduleNotActivated", { module: label })}</CardTitle>
          <CardDescription>
            {t("onboarding.currentPlanIntro")}{" "}
            <span className="font-medium text-foreground">{subscription.planName}</span>. {t("onboarding.moduleIncludedFrom", { module: label })}{" "}
            <span className="font-medium text-foreground">
              {PLAN_LABELS[needed] ?? needed}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {unlocked.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("onboarding.unlockWith", { plan: PLAN_LABELS[needed] ?? needed })}
              </p>
              <div className="flex flex-wrap gap-2">
                {unlocked.map((m) => (
                  <Badge key={m} variant="secondary">
                    {MODULE_LABELS[m]}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/app/billing">
                {t("onboarding.seePlans")} <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app">{t("onboarding.backToDashboard")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
