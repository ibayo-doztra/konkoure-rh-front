import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { JobForm, type JobInitial, type DocItem } from "@/components/jobs/JobForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/recruitment/jobs/$id/edit")({
  component: EditJobPage,
});

function EditJobPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const [initial, setInitial] = useState<JobInitial | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await pendingQuery("GET /org/recruitment/jobs");
      if (!data) { setNotFound(true); return; }
      setInitial({
        id: data.id,
        slug: data.slug,
        title: data.title,
        location: data.location ?? "",
        description: data.description ?? "",
        requirements: data.requirements ?? "",
        deadline: data.deadline ?? null,
        contract_type: (data as any).contract_type ?? "cdi",
        required_documents: Array.isArray(data.required_documents) ? (data.required_documents as unknown as DocItem[]) : [],
      });
    })();
  }, [id]);

  if (notFound) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app/recruitment/jobs"><ArrowLeft className="mr-2 h-4 w-4" />{t("recruitment.jobs.back")}</Link>
      </Button>
      <p className="text-muted-foreground">{t("recruitment.jobs.notFound")}</p>
    </div>
  );
  if (!initial) return <div className="p-8 text-sm text-muted-foreground">{t("recruitment.jobs.loading")}</div>;
  return <JobForm initial={initial} />;
}
