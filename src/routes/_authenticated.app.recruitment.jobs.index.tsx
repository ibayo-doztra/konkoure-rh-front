import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarClock,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Pencil,
  Plus,
  QrCode,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  closeJob,
  deleteJob,
  duplicateJob,
  JOB_STATUS_VARIANT,
  jobsQuery,
  publishJob,
  recruitmentKey,
  type Job,
} from "@/lib/api/recruitment";
import { contractTypeLabel } from "@/lib/contract-types";
import { formatDate } from "@/lib/format";
import { useOrg } from "@/hooks/useOrg";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { ActionMenu } from "@/components/ActionMenu";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { JobQrCodeDialog } from "@/components/jobs/JobQrCodeDialog";
import { PublishToSocialsDialog } from "@/components/jobs/PublishToSocialsDialog";

export const Route = createFileRoute("/_authenticated/app/recruitment/jobs/")({
  component: JobsPage,
});

function JobsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const jobs = useQuery({ ...jobsQuery(organizationId, { page }), enabled: !!org });
  const lastPage = jobs.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null);
  const [qrJob, setQrJob] = useState<Job | null>(null);
  const [socialJob, setSocialJob] = useState<Job | null>(null);
  const { hasModule } = useSubscription();
  const canShare = hasModule("integrations");

  const refresh = () => queryClient.invalidateQueries({ queryKey: recruitmentKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const togglePublish = useMutation({
    mutationFn: (job: Job) => (job.status === "published" ? closeJob(job.id) : publishJob(job.id)),
    onSuccess: (job) => {
      toast.success(
        job.status === "published"
          ? t("recruitment.jobs.publishedSuccess")
          : t("recruitment.jobs.closedSuccess"),
      );
      return refresh();
    },
    onError,
  });
  const duplicate = useMutation({
    mutationFn: (job: Job) => duplicateJob(job.id),
    onSuccess: () => {
      toast.success(t("recruitment.jobs.duplicatedSuccess"));
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (job: Job) => deleteJob(job.id),
    onSuccess: () => {
      toast.success(t("recruitment.jobs.deletedSuccess"));
      setPendingDelete(null);
      return refresh();
    },
    onError,
  });

  const orgSlug = org?.slug ?? "";
  const publicUrl = (jobSlug: string) => `${window.location.origin}/careers/${orgSlug}/${jobSlug}`;
  const copyLink = (jobSlug: string) => {
    void navigator.clipboard.writeText(publicUrl(jobSlug));
    toast.success(t("recruitment.jobs.linkCopied"));
  };

  const items = jobs.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title={t("recruitment.jobs.title")}
        actions={
          <Button asChild>
            <Link to="/app/recruitment/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("recruitment.jobs.newJob")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3">
        {items.map((j) => {
          const expired = !!j.deadline && new Date(j.deadline) < new Date();
          const isPublished = j.status === "published";
          // Only a published offer with no past deadline is visible to candidates.
          const isPublic = isPublished && !expired && !!orgSlug;
          return (
            <Card key={j.id} data-testid="job-card">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-semibold">{j.title}</p>
                    <Badge variant={JOB_STATUS_VARIANT[j.status]} className="shrink-0">
                      {t(`recruitment.jobs.statuses.${j.status}`)}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{j.location || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{contractTypeLabel(j.contractType)}</Badge>
                    {j.deadline && (
                      <span
                        className={`inline-flex items-center gap-1 ${expired ? "text-destructive" : ""}`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {expired ? t("recruitment.jobs.expiredOn") : t("recruitment.jobs.until")}
                        {formatDate(j.deadline)}
                      </span>
                    )}
                    <span>
                      {t("recruitment.jobs.documentsRequested", {
                        // The CV comes on top of the listed pieces.
                        count: j.requiredDocuments.length + 1,
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/app/recruitment/jobs/$id/edit" params={{ id: j.id }}>
                      <Pencil className="mr-1 h-4 w-4" />
                      {t("recruitment.jobs.editJob")}
                    </Link>
                  </Button>
                  {j.status !== "archived" && (
                    <Button
                      size="sm"
                      variant={isPublished ? "outline" : "default"}
                      disabled={togglePublish.isPending}
                      onClick={() => togglePublish.mutate(j)}
                    >
                      {isPublished ? (
                        <>
                          <Archive className="mr-1 h-4 w-4" />
                          {t("recruitment.jobs.close")}
                        </>
                      ) : (
                        <>
                          <Send className="mr-1 h-4 w-4" />
                          {t("recruitment.jobs.publishAction")}
                        </>
                      )}
                    </Button>
                  )}
                  <ActionMenu
                    items={[
                      {
                        label: t("recruitment.jobs.copyLink"),
                        icon: <LinkIcon className="h-4 w-4" />,
                        onSelect: () => copyLink(j.slug),
                        hidden: !isPublic,
                      },
                      {
                        label: t("recruitment.jobs.openPublic"),
                        icon: <ExternalLink className="h-4 w-4" />,
                        href: publicUrl(j.slug),
                        hidden: !isPublic,
                      },
                      {
                        label: t("recruitment.jobs.qrCode"),
                        icon: <QrCode className="h-4 w-4" />,
                        onSelect: () => setQrJob(j),
                        hidden: !isPublic,
                      },
                      {
                        label: t("recruitment.social.action"),
                        icon: <Share2 className="h-4 w-4" />,
                        onSelect: () => setSocialJob(j),
                        // The API only shares a published offer (409 otherwise).
                        hidden: !isPublished || !canShare,
                      },
                      {
                        label: t("recruitment.jobs.duplicate"),
                        icon: <Copy className="h-4 w-4" />,
                        onSelect: () => duplicate.mutate(j),
                      },
                      { type: "separator" },
                      {
                        label: t("recruitment.jobs.delete"),
                        icon: <Trash2 className="h-4 w-4" />,
                        onSelect: () => setPendingDelete(j),
                        variant: "destructive",
                      },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!jobs.isPending && items.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {jobs.isError ? apiErrorMessage(jobs.error) : t("recruitment.jobs.empty")}
            </CardContent>
          </Card>
        )}
        <ListPager page={page} lastPage={lastPage} onChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => {
          if (!v) setPendingDelete(null);
        }}
        title={t("recruitment.jobs.deleteTitle")}
        subtitle={pendingDelete?.title}
        description={
          pendingDelete?.title
            ? t("recruitment.jobs.deleteDescription", { title: pendingDelete.title })
            : t("recruitment.jobs.deleteDescriptionGeneric")
        }
        cancelLabel={t("recruitment.jobs.cancel")}
        actionLabel={
          remove.isPending ? t("recruitment.jobs.deleting") : t("recruitment.jobs.delete")
        }
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />

      <JobQrCodeDialog
        open={!!qrJob}
        onOpenChange={(v) => {
          if (!v) setQrJob(null);
        }}
        url={qrJob ? publicUrl(qrJob.slug) : ""}
        jobTitle={qrJob?.title ?? ""}
      />

      <PublishToSocialsDialog
        job={socialJob}
        onOpenChange={(v) => {
          if (!v) setSocialJob(null);
        }}
      />
    </div>
  );
}
