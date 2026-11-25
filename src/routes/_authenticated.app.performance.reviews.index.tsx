import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Calendar, Users } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  cyclesQuery,
  plansQuery,
  REVIEW_STATUS_CLASS,
  reviewsQuery,
  type PlanStatus,
  type ReviewStatus,
  type ReviewSummary,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmployeeCombobox,
  type EmployeeComboboxOption,
} from "@/components/employees/EmployeeCombobox";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/app/performance/reviews/")({
  component: ReviewsPage,
});

const PLAN_STATUS_VARIANT: Record<PlanStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  closed: "secondary",
};

const DONE: readonly ReviewStatus[] = ["submitted", "validated", "signed"];

function ReviewsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const access = usePerformanceAccess();
  const reviews = useQuery({ ...reviewsQuery(organizationId), enabled: !!org });
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });
  const cycles = useQuery({ ...cyclesQuery(organizationId), enabled: !!org });
  const [tab, setTab] = useState("mine");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const reviewList = useMemo(() => reviews.data ?? [], [reviews.data]);
  const planById = useMemo(() => new Map((plans.data ?? []).map((p) => [p.id, p])), [plans.data]);
  const cycleById = useMemo(
    () => new Map((cycles.data ?? []).map((c) => [c.id, c])),
    [cycles.data],
  );

  const toOption = (id: string): EmployeeComboboxOption => {
    const e = access.employees.find((x) => x.id === id);
    return {
      id,
      first_name: e?.firstName ?? access.nameOf(id) ?? "",
      last_name: e?.lastName ?? "",
      photo_url: e?.photoUrl ?? null,
      position: e?.jobTitle ?? null,
    };
  };
  const me = access.myEmployeeId;
  // The API already scopes the list: everyone for HR, the team for a manager.
  const teamOptions = useMemo(
    () =>
      Array.from(new Set(reviewList.map((r) => r.employeeId)))
        .filter((id) => id !== me)
        .map(toOption)
        .sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewList, me, access.employees],
  );

  const currentEmployeeId = selectedEmployeeId ?? me;
  const isSelf = !selectedEmployeeId || selectedEmployeeId === me;
  const visibleReviews = reviewList.filter((r) => r.employeeId === currentEmployeeId);
  const selectedName = currentEmployeeId ? access.nameOf(currentEmployeeId) : null;

  const reviewName = (r: ReviewSummary) =>
    (r.planId && planById.get(r.planId)?.name) ||
    (r.cycleId && cycleById.get(r.cycleId)?.name) ||
    t("reviews.review");

  const actionLabel = (r: ReviewSummary) => {
    if (!isSelf) return t("reviews.consult");
    if (r.status === "submitted" || r.status === "signed") return t("reviews.view");
    if (r.status === "not_started") return t("reviews.start");
    return t("reviews.continueAction");
  };

  return (
    <div>
      <PageHeader title={t("reviews.title")} description={t("reviews.description")} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            {isSelf
              ? t("reviews.myReviews")
              : t("reviews.reviewsOf", { name: selectedName ?? "—" })}
          </TabsTrigger>
          <TabsTrigger value="plans">{t("reviews.byPlan")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          {teamOptions.length > 0 && (
            <div className="mb-4 sm:max-w-xs">
              <EmployeeCombobox
                value={currentEmployeeId ?? ""}
                onChange={(v: string) => setSelectedEmployeeId(v === me ? null : v)}
                options={teamOptions}
                meOption={me ? toOption(me) : null}
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
                const plan = r.planId ? planById.get(r.planId) : undefined;
                const cycle = r.cycleId ? cycleById.get(r.cycleId) : undefined;
                const period = plan ?? cycle;
                return (
                  <Card key={r.id} data-testid="review-card">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {t("reviews.reviewNamePrefix")} {reviewName(r)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${REVIEW_STATUS_CLASS[r.status]}`}
                          >
                            {t(`reviews.statuses.${r.status}`)}
                          </span>
                          {period && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(period.periodStart)} → {formatDate(period.periodEnd)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button asChild>
                        <Link to="/app/performance/reviews/$id" params={{ id: r.id }}>
                          {actionLabel(r)}
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
          {(plans.data ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t("reviews.noPlans")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(plans.data ?? []).map((p) => {
                const planReviews = reviewList.filter((r) => r.planId === p.id);
                const submitted = planReviews.filter((r) => DONE.includes(r.status)).length;
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {t("reviews.reviewNamePrefix")} {p.name}
                          </p>
                          <Badge variant={PLAN_STATUS_VARIANT[p.status]}>
                            {t(`reviews.planStatuses.${p.status}`)}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
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
