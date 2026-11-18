import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api/client";
import {
  deleteOrganization,
  updateOrganization,
  uploadOrganizationLogo,
} from "@/lib/api/organization";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Upload, Trash2, Target, Layers } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  component: SettingsPage,
});

/** Formats accepted by `POST /org/logo`; the API checks the real file signature. */
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function SettingsPage() {
  const { t } = useTranslation();
  const LANGUAGES = [
    { value: "fr", label: "Français" },
    { value: "en", label: "English" },
  ];
  const { org, refresh } = useOrg();
  const { user } = useAuth();
  const { roles } = useRole();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  
  const [language, setLanguage] = useState("fr");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [perfModel, setPerfModel] = useState<"classic" | "sap">("classic");
  const [savingPerf, setSavingPerf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!org) return;
    setName(org.name ?? "");
    
    setLanguage(org.default_language ?? "fr");
    setLogoUrl((org as any).logo_url ?? null);
    setPerfModel(((org as any).performance_model as "classic" | "sap") ?? "classic");
  }, [org?.id]);

  const onSavePerfModel = async (next: "classic" | "sap") => {
    if (!org || next === perfModel) return;
    setSavingPerf(true);
    setPerfModel(next);
    try {
      await updateOrganization({ performanceModel: next });
      toast.success(t("settings.performanceModelUpdated"));
      await refresh();
    } catch (error) {
      setPerfModel(perfModel);
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingPerf(false);
    }
  };

  const onSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await updateOrganization({
        name: name.trim(),
        defaultLanguage: language === "en" ? "en" : "fr",
      });
      toast.success(t("settings.saved"));
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = () => fileInput.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !org) return;
    if (!LOGO_TYPES.includes(file.type)) { toast.error(t("settings.selectImage")); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error(t("settings.imageTooLarge")); return; }
    setUploading(true);
    try {
      const updated = await uploadOrganizationLogo(file);
      setLogoUrl(updated.logoUrl);
      toast.success(t("settings.logoUploaded"));
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.generalTitle")} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardContent className="space-y-6 p-6">
            <h3 className="font-semibold">{t("settings.organization")}</h3>

            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {logoUrl ? (
                  <img src={logoUrl} alt={t("settings.logoAlt")} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">{(name || "?")[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileInput} type="file" accept={LOGO_TYPES.join(",")} onChange={onUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={onPickFile} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {logoUrl ? t("settings.replaceLogo") : t("settings.uploadLogo")}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">{t("settings.orgName")}</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">{t("settings.orgSlug")}</Label>
                <Input id="org-slug" value={org?.slug ?? ""} disabled />
                <p className="text-xs text-muted-foreground">{t("settings.orgSlugHint")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.defaultLanguage")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.plan")}</Label>
                <Input value={org?.plan ?? ""} disabled />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving || !org}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("settings.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="space-y-4 p-6">
            <div>
              <h3 className="font-semibold">{t("settings.performanceModelTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.performanceModelDesc")}
              </p>
            </div>
            <RadioGroup
              value={perfModel}
              onValueChange={(v) => void onSavePerfModel(v as "classic" | "sap")}
              className="grid gap-3 md:grid-cols-2"
            >
              <label
                htmlFor="set-pm-classic"
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition ${
                  perfModel === "classic" ? "border-primary bg-primary/5" : "hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t("settings.modelClassic")}</span>
                  </div>
                  <RadioGroupItem value="classic" id="set-pm-classic" disabled={savingPerf} />
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.modelClassicDesc")}</p>
              </label>
              <label
                htmlFor="set-pm-sap"
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition ${
                  perfModel === "sap" ? "border-primary bg-primary/5" : "hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t("settings.modelSap")}</span>
                  </div>
                  <RadioGroupItem value="sap" id="set-pm-sap" disabled={savingPerf} />
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.modelSapDesc")}</p>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        <PerformancePlansCard />

        {/* Cycles d'évaluation : déprécié — les évaluations sont rattachées aux plans de performance. */}




        <Card className="md:col-span-2">
          <CardContent className="space-y-2 p-6">
            <h3 className="font-semibold">{t("settings.account")}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>

        {roles.includes("owner") && org && <DeleteOrganizationCard name={org.name} />}
      </div>
    </div>
  );
}

function DeleteOrganizationCard({ name }: { name: string }) {
  const { t } = useTranslation();
  const { refresh } = useOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    setConfirmName("");
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrganization(confirmName);
      toast.success(t("settings.orgDeleted"));
      queryClient.clear();
      // Selects another organization, or leads to onboarding when none is left.
      await refresh();
      await navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error));
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40 md:col-span-2">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{t("settings.dangerTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.dangerDesc")}</p>
        </div>
        <Button variant="destructive" className="shrink-0" onClick={() => onOpenChange(true)}>
          {t("settings.deleteOrg")}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("settings.deleteOrg")}</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="delete-org-name">{t("settings.deleteOrgConfirmLabel", { name })}</Label>
              <Input
                id="delete-org-name"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </div>
            <DialogActions>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button variant="destructive" disabled={confirmName !== name || deleting} onClick={() => void onDelete()}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("settings.deleteOrgConfirm")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PerformanceCyclesCard() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const [cycles, setCycles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState<"annual" | "semestrial" | "quarterly" | "custom">("annual");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!org) return;
    const { data } = await pendingQuery("GET /org/performance/cycles");
    setCycles(data ?? []);
  };
  useEffect(() => { void load(); }, [org?.id]);

  const create = async () => {
    if (!org || !name.trim() || !periodStart || !periodEnd) return toast.error(t("settings.planNameRequired"));
    setBusy(true);
    const { error } = await pendingQuery("POST /org/performance/cycles");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings.cycleCreated"));
    setOpen(false);
    setName(""); setPeriodStart(""); setPeriodEnd(""); setOpensAt(""); setClosesAt("");
    void load();
  };

  const openCycle = async (c: any) => {
    if (!org) return;
    if (!(await confirm({ title: t("settings.openCycleConfirm"), subtitle: c.name, description: t("settings.openCycleConfirmDesc"), actionLabel: t("common.confirm") }))) return;
    setBusy(true);
    const { data: emps } = await pendingQuery("GET /org/employees");
    if (!emps?.length) { setBusy(false); return toast.error(t("settings.noActiveEmployee")); }
    const reviewsToInsert = emps.map((e: any) => ({
      organization_id: org.id, cycle_id: c.id, employee_id: e.id, manager_id: e.manager_id,
    }));
    const { data: inserted, error } = await pendingQuery("PUT /org/performance/reviews");
    if (error) { setBusy(false); return toast.error(error.message); }
    const notifs = (inserted ?? []).map((r: any) => {
      const emp = emps.find((e: any) => e.id === r.employee_id);
      return emp?.user_id ? {
        organization_id: org.id,
        user_id: emp.user_id,
        type: "review_opened",
        title: t("settings.reviewOpenedTitle", { name: c.name }),
        body: c.self_eval_closes_at
          ? t("settings.reviewOpenedBodyWithDeadline", { date: formatDate(c.self_eval_closes_at) })
          : t("settings.reviewOpenedBody"),
        link: `/app/performance/reviews/${r.id}`,
      } : null;
    }).filter(Boolean);
    if (notifs.length) await pendingQuery("POST /me/notifications");
    await pendingQuery("PATCH /org/performance/cycles");
    setBusy(false);
    toast.success(t("settings.cycleOpened", { count: inserted?.length ?? 0 }));
    void load();
  };

  const closeCycle = async (c: any) => {
    if (!(await confirm({ title: t("settings.closeCycleConfirm"), subtitle: c.name, description: t("settings.closeCycleConfirmDesc"), actionLabel: t("common.confirm") }))) return;
    await pendingQuery("PATCH /org/performance/cycles");
    void load();
  };

  return (
    <Card className="md:col-span-2">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t("settings.cyclesTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings.cyclesDesc")}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm">{t("settings.newCycle")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("settings.newCycleTitle")}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="space-y-3">
                  <div><Label>{t("settings.cycleName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("settings.cycleNamePlaceholder")} /></div>
                  <div><Label>{t("settings.cycleFrequency")}</Label>
                    <Select value={freq} onValueChange={(v: any) => setFreq(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">{t("settings.freqAnnual")}</SelectItem>
                        <SelectItem value="semestrial">{t("settings.freqSemestrial")}</SelectItem>
                        <SelectItem value="quarterly">{t("settings.freqQuarterly")}</SelectItem>
                        <SelectItem value="custom">{t("settings.freqCustom")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("settings.periodStartLong")}</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                    <div><Label>{t("settings.periodEndLong")}</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("settings.selfEvalOpen")}</Label><Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></div>
                    <div><Label>{t("settings.selfEvalClose")}</Label><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
                  </div>
                  <Button className="w-full" onClick={create} disabled={busy}>{t("settings.createBtn")}</Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>

        {cycles.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("settings.noCycle")}</p>
        ) : (
          <div className="space-y-2">
            {cycles.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.frequency} · {c.period_start} → {c.period_end} · {c.status}</p>
                </div>
                <div className="flex gap-2">
                  {c.status === "draft" && <Button size="sm" onClick={() => openCycle(c)} disabled={busy}>{t("settings.openCycle")}</Button>}
                  {c.status === "open" && <Button size="sm" variant="outline" onClick={() => closeCycle(c)}>{t("settings.finalize")}</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PerformancePlansCard() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const [plans, setPlans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "closed">("active");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!org) return;
    const { data } = await pendingQuery("GET /org/performance/plans");
    setPlans((data as any[]) ?? []);
  };
  useEffect(() => { void load(); }, [org?.id]);

  const reset = () => { setName(""); setPeriodStart(""); setPeriodEnd(""); setStatus("active"); };

  const create = async () => {
    if (!org || !name.trim() || !periodStart || !periodEnd) return toast.error(t("settings.planNameRequired"));
    setBusy(true);
    const { error } = await pendingQuery("POST /org/performance/plans");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings.planCreated"));
    setOpen(false);
    reset();
    void load();
  };

  const setPlanStatus = async (p: any, next: "draft" | "active" | "closed") => {
    const { error } = await pendingQuery("PATCH /org/performance/plans/:id (absent de 06)");
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (p: any) => {
    if (!(await confirm({ title: t("settings.deletePlanConfirm"), subtitle: p.name, description: t("settings.deletePlanConfirmDesc"), actionLabel: t("common.delete"), actionVariant: "destructive" }))) return;
    const { error } = await pendingQuery("DELETE /org/performance/plans/:id (absent de 06)");
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card className="md:col-span-2">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t("settings.performancePlansTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings.performancePlansDesc")}</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button size="sm">{t("settings.newPlan")}</Button></DialogTrigger>
            <DialogContent
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader><DialogTitle>{t("settings.newPlan")}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="space-y-3">
                  <div><Label>{t("settings.planName")} <span className="text-destructive">*</span></Label>
                    <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t("settings.planNamePlaceholder")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("settings.periodStart")}</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                    <div><Label>{t("settings.periodEnd")}</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
                  </div>
                  <div><Label>{t("settings.status")}</Label>
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t("settings.statusDraft")}</SelectItem>
                        <SelectItem value="active">{t("settings.statusActive")}</SelectItem>
                        <SelectItem value="closed">{t("settings.statusClosed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>{t("settings.closeBtn")}</Button>
                    <Button onClick={create} disabled={busy}>{t("settings.createBtn")}</Button>
                  </div>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>

        {plans.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("settings.noPlan")}</p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.period_start} → {p.period_end} · {p.status}</p>
                </div>
                <div className="flex gap-2">
                  {p.status !== "active" && <Button size="sm" variant="outline" onClick={() => setPlanStatus(p, "active")}>{t("settings.activate")}</Button>}
                  {p.status !== "closed" && <Button size="sm" variant="outline" onClick={() => setPlanStatus(p, "closed")}>{t("settings.finalize")}</Button>}
                  <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


