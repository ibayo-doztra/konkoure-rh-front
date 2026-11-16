import { createFileRoute } from "@tanstack/react-router";
import { JobForm } from "@/components/jobs/JobForm";

export const Route = createFileRoute("/_authenticated/app/recruitment/jobs/new")({
  component: () => <JobForm />,
});
