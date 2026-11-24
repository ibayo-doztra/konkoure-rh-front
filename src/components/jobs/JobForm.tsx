import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, FileText, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createJob,
  MAX_REQUIRED_DOCUMENTS,
  publishJob,
  recruitmentKey,
  updateJob,
  type Job,
  type JobInput,
  type RequiredDocument,
} from "@/lib/api/recruitment";
import { CONTRACT_TYPES, contractTypeLabel, type ContractType } from "@/lib/contract-types";
import { slugify } from "@/lib/slug";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export type DocItem = RequiredDocument;

const PRESET_KEYS: { key: string; i18n: string }[] = [
  { key: "cover_letter", i18n: "coverLetter" },
  { key: "diploma", i18n: "diploma" },
  { key: "work_certificate", i18n: "workCertificate" },
  { key: "id_document", i18n: "idDocument" },
  { key: "portfolio", i18n: "portfolio" },
];

/** API key format: `^[a-z][a-z0-9_]{0,39}$`. */
function documentKey(label: string) {
  const key = slugify(label)
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return (/^[a-z]/.test(key) ? key : `doc_${key}`).slice(0, 40);
}

/** `datetime-local` value of an ISO date, in the browser's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function DocumentsEditor({
  value,
  onChange,
}: {
  value: DocItem[];
  onChange: (v: DocItem[]) => void;
}) {
  const { t } = useTranslation();
  const [customLabel, setCustomLabel] = useState("");
  const has = (key: string) => value.some((d) => d.key === key);
  const full = value.length >= MAX_REQUIRED_DOCUMENTS;
  const add = (item: DocItem) => {
    if (!has(item.key) && !full) onChange([...value, item]);
  };
  const remove = (key: string) => onChange(value.filter((d) => d.key !== key));
  const toggleRequired = (key: string) =>
    onChange(value.map((d) => (d.key === key ? { ...d, required: !d.required } : d)));
  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const key = documentKey(label);
    if (has(key) || key === "cv") {
      toast.error(t("recruitment.form.documentExists"));
      return;
    }
    if (full) {
      toast.error(t("recruitment.form.tooManyDocuments", { max: MAX_REQUIRED_DOCUMENTS }));
      return;
    }
    onChange([...value, { key, label, required: false }]);
    setCustomLabel("");
  };

  return (
    <div className="space-y-3">
      <Label>{t("recruitment.form.documentsLabel")}</Label>
      <div className="space-y-2">
        {/* The CV is always required by the API: shown, never sent. */}
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {t("recruitment.form.cvLabel")}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {t("recruitment.form.alwaysRequired")}
          </span>
        </div>
        {value.map((d) => (
          <div
            key={d.key}
            className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary/40"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <span className="flex-1 truncate text-sm font-medium text-foreground">{d.label}</span>
            <button
              type="button"
              onClick={() => toggleRequired(d.key)}
              aria-pressed={d.required}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                (d.required
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70")
              }
            >
              <span
                className={
                  "grid h-3.5 w-3.5 place-items-center rounded-full border " +
                  (d.required
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40")
                }
              >
                {d.required && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {t("recruitment.form.required")}
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(d.key)}
              aria-label={t("recruitment.form.removeDocument", { label: d.label })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {!full && (
        <>
          <div className="flex flex-wrap gap-2">
            {PRESET_KEYS.filter((p) => !has(p.key)).map((p) => (
              <Button
                key={p.key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  add({
                    key: p.key,
                    label: t(`recruitment.form.presets.${p.i18n}`),
                    required: false,
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                {t(`recruitment.form.presets.${p.i18n}`)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("recruitment.form.customDocumentPlaceholder")}
              aria-label={t("recruitment.form.customDocumentPlaceholder")}
              value={customLabel}
              maxLength={120}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addCustom}>
              {t("recruitment.form.addDocument")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function JobForm({ initial }: { initial?: Job }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = !!initial;
  const isPublished = initial?.status === "published";

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    requirements: initial?.requirements ?? "",
    deadline: toLocalInput(initial?.deadline ?? null),
    contractType: (initial?.contractType ?? "cdi") as ContractType,
    documents: (initial?.requiredDocuments ?? []).filter((d) => d.key !== "cv"),
  });

  const payload = (): JobInput => ({
    title: form.title.trim(),
    contractType: form.contractType,
    location: form.location.trim() || null,
    description: form.description.trim() || null,
    requirements: form.requirements.trim() || null,
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    requiredDocuments: form.documents,
  });

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const job = initial ? await updateJob(initial.id, payload()) : await createJob(payload());
      if (!publish || job.status === "published") return { job, published: false };
      try {
        return { job: await publishJob(job.id), published: true };
      } catch (error) {
        // Saved but not published: keep editing the same record, never a duplicate.
        return { job, published: false, publishError: error };
      }
    },
    onSuccess: async ({ job, published, publishError }) => {
      await queryClient.invalidateQueries({ queryKey: recruitmentKey(org?.id ?? "") });
      if (publishError) {
        toast.error(apiErrorMessage(publishError));
        if (!initial) {
          void navigate({ to: "/app/recruitment/jobs/$id/edit", params: { id: job.id } });
        }
        return;
      }
      toast.success(
        published
          ? t("recruitment.jobs.publishedSuccess")
          : editing
            ? t("recruitment.form.updatedSuccess")
            : t("recruitment.form.savedSuccess"),
      );
      void navigate({ to: "/app/recruitment/jobs" });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = (publish: boolean) => {
    if (form.title.trim().length < 2) {
      toast.error(t("recruitment.form.titleRequired"));
      return;
    }
    save.mutate(publish);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/recruitment/jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("recruitment.form.backToJobs")}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {editing ? t("recruitment.form.editJobTitle") : t("recruitment.form.newJobTitle")}
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <Label htmlFor="job-title">{t("recruitment.form.titleLabel")}</Label>
            <Input
              id="job-title"
              placeholder={t("recruitment.form.titlePlaceholder")}
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("recruitment.form.descriptionLabel")}</Label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm({ ...form, description: html })}
              placeholder={t("recruitment.form.descriptionPlaceholder")}
              minHeight={220}
            />
          </div>
          <div>
            <Label>{t("recruitment.form.requirementsLabel")}</Label>
            <RichTextEditor
              value={form.requirements}
              onChange={(html) => setForm({ ...form, requirements: html })}
              placeholder={t("recruitment.form.requirementsPlaceholder")}
              minHeight={180}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label htmlFor="job-location">{t("recruitment.form.locationLabel")}</Label>
            <Input
              id="job-location"
              placeholder={t("recruitment.form.locationPlaceholder")}
              value={form.location}
              maxLength={200}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="job-contract">{t("recruitment.form.contractTypeLabel")}</Label>
            <Select
              value={form.contractType}
              onValueChange={(v) => setForm({ ...form, contractType: v as ContractType })}
            >
              <SelectTrigger id="job-contract">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {contractTypeLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-deadline">{t("recruitment.form.deadlineLabel")}</Label>
            <Input
              id="job-deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <DocumentsEditor
            value={form.documents}
            onChange={(documents) => setForm({ ...form, documents })}
          />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <Button variant="ghost" asChild>
          <Link to="/app/recruitment/jobs">{t("recruitment.form.cancel")}</Link>
        </Button>
        {isPublished ? (
          // A published offer is only edited; closing it is done from the list.
          <Button onClick={() => submit(false)} disabled={save.isPending}>
            {t("recruitment.form.save")}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => submit(false)} disabled={save.isPending}>
              {editing ? t("recruitment.form.saveDraftEditing") : t("recruitment.form.saveDraft")}
            </Button>
            <Button onClick={() => submit(true)} disabled={save.isPending}>
              {editing ? t("recruitment.form.publishEditing") : t("recruitment.form.publish")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
