import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { apiErrorMessage, ApiError } from "@/lib/api/client";
import { jobQuery } from "@/lib/api/recruitment";
import { useOrg } from "@/hooks/useOrg";
import { JobForm } from "@/components/jobs/JobForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/recruitment/jobs/$id/edit")({
  component: EditJobPage,
});

function EditJobPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { org } = useOrg();
  const job = useQuery({ ...jobQuery(org?.id ?? "", id), enabled: !!org });

  if (job.isPending) {
    return <div className="p-8 text-sm text-muted-foreground">{t("recruitment.jobs.loading")}</div>;
  }
  if (!job.data) {
    const notFound = job.error instanceof ApiError && job.error.status === 404;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/recruitment/jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("recruitment.jobs.back")}
          </Link>
        </Button>
        <p className="text-muted-foreground">
          {notFound || !job.error ? t("recruitment.jobs.notFound") : apiErrorMessage(job.error)}
        </p>
      </div>
    );
  }
  // Remounted per version, so the form starts from the saved values.
  return <JobForm key={job.data.updatedAt} initial={job.data} />;
}
