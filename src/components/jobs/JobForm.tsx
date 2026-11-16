import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_TYPES, type ContractType } from "@/lib/contract-types";
import { Plus, Sparkles, PencilLine, Trash2, ArrowLeft, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { slugify, uniqueSlug } from "@/lib/slug";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useTranslation } from "react-i18next";

export type DocItem = { key: string; label: string; required: boolean };

export const DEFAULT_DOCS: DocItem[] = [{ key: "cv", label: "CV", required: true }];
const PRESET_KEYS: { key: string; i18n: string }[] = [
  { key: "cover_letter", i18n: "coverLetter" },
  { key: "diploma", i18n: "diploma" },
  { key: "work_certificate", i18n: "workCertificate" },
  { key: "id_document", i18n: "idDocument" },
  { key: "portfolio", i18n: "portfolio" },
];

const EMPTY_AI = { title: "", location: "", seniority: "mid", contract_type: "cdi" as ContractType, requirements: "" };

export interface JobInitial {
  id?: string;
  slug?: string | null;
  title?: string;
  location?: string;
  description?: string;
  requirements?: string;
  deadline?: string | null;
  contract_type?: ContractType | null;
  required_documents?: DocItem[];
}

function DocumentsEditor({ value, onChange }: { value: DocItem[]; onChange: (v: DocItem[]) => void }) {
  const { t } = useTranslation();
  const [customLabel, setCustomLabel] = useState("");
  const has = (key: string) => value.some((d) => d.key === key);
  const add = (item: DocItem) => { if (!has(item.key)) onChange([...value, item]); };
  const remove = (key: string) => onChange(value.filter((d) => d.key !== key));
  const toggleRequired = (key: string) => onChange(value.map((d) => d.key === key ? { ...d, required: !d.required } : d));
  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const key = slugify(label).replace(/-/g, "_");
    if (has(key)) { toast.error(t("recruitment.form.documentExists")); return; }
    onChange([...value, { key, label, required: false }]);
    setCustomLabel("");
  };

  return (
    <div className="space-y-3">
      <Label>{t("recruitment.form.documentsLabel")}</Label>
      <div className="space-y-2">
        {value.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            {t("recruitment.form.noDocuments")}
          </p>
        )}
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
                  (d.required ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")
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
      <div className="flex flex-wrap gap-2">
        {PRESET_KEYS.filter((p) => !has(p.key)).map((p) => (
          <Button key={p.key} type="button" size="sm" variant="outline" onClick={() => add({ key: p.key, label: t(`recruitment.form.presets.${p.i18n}` as any), required: false })}>
            <Plus className="mr-1 h-3 w-3" />{t(`recruitment.form.presets.${p.i18n}` as any)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder={t("recruitment.form.customDocumentPlaceholder")} value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <Button type="button" variant="secondary" onClick={addCustom}>{t("recruitment.form.addDocument")}</Button>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string) {
  if (!text) return "";
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");
}

function listToHtml(items: string[]) {
  if (!items?.length) return "";
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

export function JobForm({ initial }: { initial?: JobInitial }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const navigate = useNavigate();
  const editingId = initial?.id ?? null;
  const editingSlug = initial?.slug ?? null;

  const [tab, setTab] = useState("manual");
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    requirements: initial?.requirements ?? "",
    deadline: initial?.deadline ? new Date(initial.deadline).toISOString().slice(0, 16) : "",
    contract_type: (initial?.contract_type ?? "cdi") as ContractType,
    documents: (initial?.required_documents && initial.required_documents.length > 0
      ? initial.required_documents
      : [...DEFAULT_DOCS]) as DocItem[],
  });
  const [aiForm, setAiForm] = useState({ ...EMPTY_AI, title: initial?.title ?? "", location: initial?.location ?? "" });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!aiForm.title.trim()) { toast.error(t("recruitment.form.jobTitleRequiredError")); return; }
    setGenerating(true);
    try {
      const { data, error } = await pendingQuery("POST /org/recruitment/jobs/:id/generate");
      if (error) throw error;
      const suggested: DocItem[] = Array.isArray(data.suggested_documents)
        ? data.suggested_documents
            .map((d: any) => ({ key: String(d.key || slugify(d.label || "")).replace(/-/g, "_"), label: String(d.label || ""), required: !!d.required }))
            .filter((d: DocItem) => d.key && d.label)
        : [];
      const docs = suggested.length > 0
        ? (suggested.some((d) => d.key === "cv") ? suggested : [{ key: "cv", label: "CV", required: true }, ...suggested])
        : [...DEFAULT_DOCS];
      setForm((f) => ({
        ...f,
        title: data.title ?? aiForm.title,
        location: data.location ?? aiForm.location ?? f.location,
        contract_type: aiForm.contract_type,
        description: textToHtml(data.description ?? ""),
        requirements: listToHtml(Array.isArray(data.requirements) ? data.requirements : []),
        documents: docs,
      }));
      if (data.inclusive_warnings?.length) toast.warning(t("recruitment.form.inclusiveWarnings", { list: data.inclusive_warnings.join(", ") }));
      else toast.success(t("recruitment.form.generatedSuccess"));
      setTab("manual");
    } catch (e: any) {
      toast.error(e.message ?? t("recruitment.form.aiError"));
    } finally {
      setGenerating(false);
    }
  };

  const save = async (status: "draft" | "published") => {
    if (!org) return;
    if (!form.title.trim()) { toast.error(t("recruitment.form.titleRequired")); return; }
    if (form.documents.length === 0) { toast.error(t("recruitment.form.atLeastOneDocument")); return; }
    setSaving(true);
    try {
      let slug = editingSlug;
      if (!slug) {
        slug = await uniqueSlug(form.title, async (s) => {
          const { data } = await pendingQuery("GET /org/recruitment/jobs");
          return !!data;
        });
      }
      const payload: any = {
        title: form.title,
        location: form.location,
        description: form.description,
        requirements: form.requirements,
        status,
        organization_id: org.id,
        slug,
        required_documents: form.documents,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        contract_type: form.contract_type,
      };
      const { error } = editingId
        ? await pendingQuery("PATCH /org/recruitment/jobs")
        : await pendingQuery("POST /org/recruitment/jobs");
      if (error) throw error;
      toast.success(editingId ? t("recruitment.form.updatedSuccess") : t("recruitment.form.savedSuccess"));
      navigate({ to: "/app/recruitment/jobs" });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/recruitment/jobs"><ArrowLeft className="mr-2 h-4 w-4" />{t("recruitment.form.backToJobs")}</Link>
          </Button>
          <h1 className="text-2xl font-semibold">{editingId ? t("recruitment.form.editJobTitle") : t("recruitment.form.newJobTitle")}</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="manual"><PencilLine className="mr-2 h-4 w-4" />{t("recruitment.form.manual")}</TabsTrigger>
          <TabsTrigger value="ai" disabled={!!editingId}><Sparkles className="mr-2 h-4 w-4" />{t("recruitment.form.aiAssisted")}</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-5 pt-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div>
                <Label>{t("recruitment.form.titleLabel")}</Label>
                <Input placeholder={t("recruitment.form.titlePlaceholder")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>{t("recruitment.form.descriptionLabel")}</Label>
                <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })}
                  placeholder={t("recruitment.form.descriptionPlaceholder")} minHeight={220} />
              </div>
              <div>
                <Label>{t("recruitment.form.requirementsLabel")}</Label>
                <RichTextEditor value={form.requirements} onChange={(html) => setForm({ ...form, requirements: html })}
                  placeholder={t("recruitment.form.requirementsPlaceholder")} minHeight={180} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label>{t("recruitment.form.locationLabel")}</Label>
                <Input placeholder={t("recruitment.form.locationPlaceholder")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <Label>{t("recruitment.form.contractTypeLabel")}</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v as ContractType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("recruitment.form.deadlineLabel")}</Label>
                <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <DocumentsEditor value={form.documents} onChange={(documents) => setForm({ ...form, documents })} />
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
            <Button variant="ghost" asChild>
              <Link to="/app/recruitment/jobs">{t("recruitment.form.cancel")}</Link>
            </Button>
            <Button variant="outline" onClick={() => save("draft")} disabled={saving}>
              {editingId ? t("recruitment.form.saveDraftEditing") : t("recruitment.form.saveDraft")}
            </Button>
            <Button onClick={() => save("published")} disabled={saving}>
              {editingId ? t("recruitment.form.publishEditing") : t("recruitment.form.publish")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-5 pt-6">
          <div className="rounded-lg border bg-primary-soft/40 p-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 font-medium text-primary"><Sparkles className="h-4 w-4" />{t("recruitment.form.aiGeneratorTitle")}</span>
            <p className="mt-1">{t("recruitment.form.aiGeneratorDesc")}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <Label>{t("recruitment.form.jobTitleRequired")} <span className="text-destructive">*</span></Label>
              <Input placeholder={t("recruitment.form.titlePlaceholder")} value={aiForm.title} onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })} />
            </div>
            <div>
              <Label>{t("recruitment.form.locationLabel")}</Label>
              <Input placeholder={t("recruitment.form.locationPlaceholder")} value={aiForm.location} onChange={(e) => setAiForm({ ...aiForm, location: e.target.value })} />
            </div>
            <div>
              <Label>{t("recruitment.form.seniority")}</Label>
              <Select value={aiForm.seniority} onValueChange={(v) => setAiForm({ ...aiForm, seniority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">{t("recruitment.form.seniorityJunior")}</SelectItem>
                  <SelectItem value="mid">{t("recruitment.form.seniorityMid")}</SelectItem>
                  <SelectItem value="senior">{t("recruitment.form.seniorySenior")}</SelectItem>
                  <SelectItem value="lead">{t("recruitment.form.seniorityLead")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("recruitment.form.contractTypeLabel")}</Label>
              <Select value={aiForm.contract_type} onValueChange={(v) => setAiForm({ ...aiForm, contract_type: v as ContractType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label>{t("recruitment.form.specificRequirements")}</Label>
              <Textarea rows={4}
                placeholder={t("recruitment.form.specificRequirementsPlaceholder")}
                value={aiForm.requirements} onChange={(e) => setAiForm({ ...aiForm, requirements: e.target.value })} />
            </div>
          </div>
          <Button className="w-full lg:w-auto" onClick={generate} disabled={generating}>
            <Sparkles className="mr-2 h-4 w-4" />{generating ? t("recruitment.form.generating") : t("recruitment.form.generate")}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
