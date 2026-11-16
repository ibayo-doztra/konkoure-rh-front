import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Plus, Trash2, ExternalLink, Link as LinkIcon, CalendarClock, Pencil, Send, Archive, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ActionMenu } from "@/components/ActionMenu";
import { uniqueSlug } from "@/lib/slug";
import { PublishToSocialsDialog } from "@/components/jobs/PublishToSocialsDialog";
import { JobQrCodeDialog } from "@/components/jobs/JobQrCodeDialog";

export const Route = createFileRoute("/_authenticated/app/recruitment/jobs/")({
  component: JobsPage,
});

type DocItem = { key: string; label: string; required: boolean };

function JobsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareJob, setShareJob] = useState<any | null>(null);
  const [qrJob, setQrJob] = useState<any | null>(null);

  const load = async () => {
    if (!org) return;
    const { data } = await pendingQuery("GET /org/recruitment/jobs");
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, [org]);

  const togglePublish = async (j: any) => {
    if (!org) return;
    try {
      const next = j.status === "published" ? "draft" : "published";
      let slug = j.slug;
      if (next === "published" && !slug) {
        slug = await uniqueSlug(j.title, async (s) => {
          const { data } = await pendingQuery("GET /org/recruitment/jobs");
          return !!data;
        });
      }
      const { error } = await pendingQuery("PATCH /org/recruitment/jobs");
      if (error) throw error;
      toast.success(next === "published" ? t("recruitment.jobs.publishedSuccess") : t("recruitment.jobs.unpublishedSuccess"));
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await pendingQuery("DELETE /org/recruitment/jobs");
      if (error) throw error;
      toast.success(t("recruitment.jobs.deletedSuccess"));
      setPendingDelete(null);
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  const orgSlug = org?.slug ?? "";
  const publicUrl = (jobSlug: string) => `${window.location.origin}/careers/${orgSlug}/${jobSlug}`;
  const copyLink = (jobSlug: string) => {
    void navigator.clipboard.writeText(publicUrl(jobSlug));
    toast.success(t("recruitment.jobs.linkCopied"));
  };

  return (
    <div>
      <PageHeader
        title={t("recruitment.jobs.title")}
        actions={
          <Button asChild>
            <Link to="/app/recruitment/jobs/new"><Plus className="mr-2 h-4 w-4" />{t("recruitment.jobs.newJob")}</Link>
          </Button>
        }
      />
      <div className="grid gap-3">
        {items.map((j) => {
          const docs: DocItem[] = Array.isArray(j.required_documents) ? j.required_documents : [];
          const expired = j.deadline && new Date(j.deadline) < new Date();
          const isPublished = j.status === "published";
          return (
            <Card key={j.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-semibold">{j.title}</p>
                    <Badge variant={isPublished ? "default" : "secondary"} className="shrink-0">{isPublished ? t("recruitment.jobs.publish") : t("recruitment.jobs.draft")}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{j.location || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {j.contract_type && (
                      <Badge variant="outline">{t(`recruitment.jobs.contractTypes.${j.contract_type}` as any, { defaultValue: j.contract_type })}</Badge>
                    )}
                    {j.deadline && (
                      <span className={`inline-flex items-center gap-1 ${expired ? "text-destructive" : ""}`}>
                        <CalendarClock className="h-3 w-3" />
                        {expired ? t("recruitment.jobs.expiredOn") : t("recruitment.jobs.until")}{new Date(j.deadline).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                    <span>{t("recruitment.jobs.documentsRequested", { count: docs.length })}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/app/recruitment/jobs/$id/edit" params={{ id: j.id }}>
                      <Pencil className="mr-1 h-4 w-4" />{t("recruitment.jobs.editJob")}
                    </Link>
                  </Button>
                  <Button size="sm" variant={isPublished ? "outline" : "default"} onClick={() => togglePublish(j)}>
                    {isPublished ? <><Archive className="mr-1 h-4 w-4" />{t("recruitment.jobs.draft")}</> : <><Send className="mr-1 h-4 w-4" />{t("recruitment.jobs.publish")}</>}
                  </Button>
                  <ActionMenu
                    items={[
                      {
                        label: t("recruitment.jobs.copyLink"),
                        icon: <LinkIcon className="h-4 w-4" />,
                        onSelect: () => copyLink(j.slug),
                        hidden: !(isPublished && j.slug && orgSlug),
                      },
                      {
                        label: t("recruitment.jobs.openPublic"),
                        icon: <ExternalLink className="h-4 w-4" />,
                        href: j.slug ? publicUrl(j.slug) : undefined,
                        hidden: !(isPublished && j.slug && orgSlug),
                      },
                      {
                        label: t("recruitment.jobs.qrCode"),
                        icon: <QrCode className="h-4 w-4" />,
                        onSelect: () => setQrJob(j),
                        hidden: !(isPublished && j.slug && orgSlug),
                      },
                      {
                        label: t("recruitment.jobs.shareOnSocials"),
                        icon: <Share2 className="h-4 w-4" />,
                        onSelect: () => setShareJob(j),
                        hidden: !isPublished,
                      },
                      { type: "separator", hidden: !isPublished },
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
        {items.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("recruitment.jobs.empty")}
          </CardContent></Card>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => { if (!v) setPendingDelete(null); }}
        title={t("recruitment.jobs.deleteTitle")}
        subtitle={pendingDelete?.title}
        description={pendingDelete?.title ? t("recruitment.jobs.deleteDescription", { title: pendingDelete.title }) : t("recruitment.jobs.deleteDescriptionGeneric")}
        cancelLabel={t("recruitment.jobs.cancel")}
        actionLabel={deleting ? t("recruitment.jobs.deleting") : t("recruitment.jobs.delete")}
        actionVariant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      <PublishToSocialsDialog
        job={shareJob}
        open={!!shareJob}
        onOpenChange={(v) => { if (!v) setShareJob(null); }}
        orgSlug={orgSlug}
      />

      <JobQrCodeDialog
        open={!!qrJob}
        onOpenChange={(v) => { if (!v) setQrJob(null); }}
        url={qrJob?.slug ? publicUrl(qrJob.slug) : ""}
        jobTitle={qrJob?.title ?? ""}
      />
    </div>
  );
}
