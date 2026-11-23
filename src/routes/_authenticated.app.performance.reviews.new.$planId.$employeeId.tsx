import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import { reviewsQuery } from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Reached from the goals screen ("Évaluer"). Evaluations are opened by HR per
// cycle (06 §9): this route only leads to the one of this plan and employee.
export const Route = createFileRoute(
  "/_authenticated/app/performance/reviews/new/$planId/$employeeId",
)({
  component: ReviewLookupPage,
});

function ReviewLookupPage() {
  const { t } = useTranslation();
  const { planId, employeeId } = Route.useParams();
  const { org } = useOrg();
  const reviews = useQuery({ ...reviewsQuery(org?.id ?? ""), enabled: !!org });

  if (reviews.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  // The most recent evaluation of this employee on this plan.
  const review = (reviews.data ?? [])
    .filter((r) => r.planId === planId && r.employeeId === employeeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (review) {
    return <Navigate to="/app/performance/reviews/$id" params={{ id: review.id }} replace />;
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="space-y-3 p-6 text-center">
        <p className="font-semibold">{t("reviews.notOpenedTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {reviews.isError ? apiErrorMessage(reviews.error) : t("reviews.notOpenedDesc")}
        </p>
        <Button asChild variant="outline">
          <Link to="/app/performance/goals">{t("reviews.backToGoals")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
