import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
import { PageHeader } from "@/components/PageHeader";
import { ArrowRight, Calendar, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/performance/reviews/")({
  component: ReviewsPage,
});

const REVIEW_STATUS_CLS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  sent_back: "bg-destructive/10 text-destructive",
  submitted: "bg-success/10 text-success-foreground",
  validated: "bg-success/15 text-success-foreground",
  signed: "bg-success/15 text-success-foreground",
};

const PLAN_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  closed: "secondary",
};

function ReviewsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [reviews, setReviews] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tab, setTab] = useState("mine");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const load = async () => {
    if (!org) return;
    const [r, p, e] = await Promise.all([
      pendingQuery("GET /org/performance/reviews"),
      pendingQuery("GET /org/performance/plans"),
      pendingQuery("GET /org/employees"),
    ]);
    const plansList = (p.data as any[]) ?? [];
    const planById = Object.fromEntries(plansList.map((x: any) => [x.id, x]));
    const reviewsWithPlan = (r.data ?? []).map((row: any) => ({
      ...row,
      performance_plans: row.plan_id ? (planById[row.plan_id] ?? null) : null,
    }));
    setReviews(reviewsWithPlan);
    setPlans(plansList);
    setEmployees(e.data ?? []);
  };
  useEffect(() => {
    void load();
  }, [org?.id]);

  const myEmp = employees.find((e) => e.user_id === user?.id);

  const fullName = (e: any) => `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "—";

  // Toute la hiérarchie descendante (N-1, N-2, …) ou toute l'organisation pour un admin.
  const teamOptions = useMemo(() => {
    const actives = employees.filter((e) => e.status !== "terminated");
    if (isAdmin) {
      return actives
        .filter((e) => e.id !== myEmp?.id)
        .sort((a, b) => fullName(a).localeCompare(fullName(b)));
    }
    if (!myEmp?.id) return [];
    const byManager = new Map<string, any[]>();
    for (const e of actives) {
      if (!e.manager_id) continue;
      const list = byManager.get(e.manager_id) ?? [];
      list.push(e);
      byManager.set(e.manager_id, list);
    }
    const seen = new Set<string>([myEmp.id]);
    const out: any[] = [];
    const queue = [myEmp.id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const child of byManager.get(current) ?? []) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        out.push(child);
        queue.push(child.id);
      }
    }
    return out.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [employees, isAdmin, myEmp?.id]);

  const currentEmployeeId = selectedEmployeeId ?? myEmp?.id ?? null;
  const isSelf = !selectedEmployeeId || selectedEmployeeId === myEmp?.id;
  const selectedEmployee = employees.find((e) => e.id === currentEmployeeId);
  const showSelector = teamOptions.length > 0;

  const visibleReviews = useMemo(
    () => reviews.filter((r) => r.employee_id === currentEmployeeId),
    [reviews, currentEmployeeId],
  );

  return (
    <div>
      <PageHeader title={t("reviews.title")} description={t("reviews.description")} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            {isSelf
              ? t("reviews.myReviews")
              : t("reviews.reviewsOf", { name: fullName(selectedEmployee) })}
          </TabsTrigger>
          <TabsTrigger value="plans">{t("reviews.byPlan")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          {showSelector && (
            <div className="mb-4 sm:max-w-xs">
              <EmployeeCombobox
                value={currentEmployeeId ?? ""}
                onChange={(v: string) => setSelectedEmployeeId(v === myEmp?.id ? null : v)}
                options={teamOptions}
                meOption={myEmp}
                label={t("reviews.collaborator")}
                placeholder={t("reviews.me")}
                searchPlaceholder={t("reviews.searchCollaborator")}
                emptyMessage={t("reviews.noCollaboratorFound")}
                triggerVariant="minimal"
              />
            </div>
          )}

          {visibleReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {isSelf ? t("reviews.noReviewsYet") : t("reviews.noReviewsForEmployee")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {visibleReviews.map((r) => {
                const statusCls = REVIEW_STATUS_CLS[r.status] ?? REVIEW_STATUS_CLS.not_started;
                const statusLabel = t(`reviews.statuses.${r.status}` as any, {
                  defaultValue: t("reviews.statuses.not_started"),
                });
                const plan = r.performance_plans;
                return (
                  <Card key={r.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {t("reviews.reviewNamePrefix")} {plan?.name ?? t("reviews.review")}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCls}`}
                          >
                            {statusLabel}
                          </span>
                          {plan && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {plan.period_start} → {plan.period_end}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button asChild>
                        <Link to="/app/performance/reviews/$id" params={{ id: r.id }}>
                          {!isSelf
                            ? t("reviews.consult")
                            : r.status === "submitted" || r.status === "signed"
                              ? t("reviews.view")
                              : r.status === "in_progress" ||
                                  r.status === "sent_back" ||
                                  r.status === "validated"
                                ? t("reviews.continueAction")
                                : t("reviews.start")}
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t("reviews.noPlans")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {plans.map((p) => {
                const planReviews = reviews.filter((r) => r.plan_id === p.id);
                const submitted = planReviews.filter((r) =>
                  ["submitted", "validated", "signed"].includes(r.status),
                ).length;
                const statusVariant = PLAN_STATUS_VARIANT[p.status] ?? PLAN_STATUS_VARIANT.draft;
                const statusLabel = t(`reviews.planStatuses.${p.status}` as any, {
                  defaultValue: t("reviews.planStatuses.draft"),
                });
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {t("reviews.reviewNamePrefix")} {p.name}
                            </p>
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {p.period_start} → {p.period_end}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {t("reviews.submittedCount", {
                                submitted,
                                total: planReviews.length,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
