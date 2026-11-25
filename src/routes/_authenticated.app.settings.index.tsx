import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import {
  deleteOrganization,
  updateOrganization,
  uploadOrganizationLogo,
} from "@/lib/api/organization";
import {
  closeCycle,
  createCycle,
  createPlan,
  cyclesQuery,
  deletePlan,
  openCycle,
  openReviews,
  performanceKey,
  plansQuery,
  updatePlan,
  type CycleFrequency,
  type PerformanceCycle,
  type PerformancePlan,
  type PlanStatus,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent } from "@/components/ui/card";
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
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Upload, Trash2, Target, Layers } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error(t("settings.selectImage"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.imageTooLarge"));
      return;
    }
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
                  <img
                    src={logoUrl}
                    alt={t("settings.logoAlt")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    {(name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  onChange={onUpload}
                  className="hidden"
                />
                <Button variant="outline" size="sm" onClick={onPickFile} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
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
              <p className="text-sm text-muted-foreground">{t("settings.performanceModelDesc")}</p>
            </div>
            <RadioGroup
              value={perfModel}
              onValueChange={(v) => void onSavePerfModel(v as "classic" | "sap")}
              className="grid gap-3 md:grid-cols-2"
            >
              <label
                htmlFor="set-pm-classic"
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition ${
                  perfModel === "classic"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
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

        <PerformanceCyclesCard />

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
          <DialogHeader>
            <DialogTitle>{t("settings.deleteOrg")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="delete-org-name">
                {t("settings.deleteOrgConfirmLabel", { name })}
              </Label>
              <Input
                id="delete-org-name"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </div>
            <DialogActions>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={confirmName !== name || deleting}
                onClick={() => void onDelete()}
              >
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

const FREQUENCY_KEY: Record<CycleFrequency, string> = {
  annual: "settings.freqAnnual",
  semestrial: "settings.freqSemestrial",
  quarterly: "settings.freqQuarterly",
  custom: "settings.freqCustom",
};

const PLAN_STATUS_KEY: Record<PlanStatus, string> = {
  draft: "settings.statusDraft",
  active: "settings.statusActive",
  closed: "settings.statusClosed",
};

const NO_PLAN = "__none__";

/** `datetime-local` value → ISO 8601, as the API expects. */
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

function PerformanceCyclesCard() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const cycles = useQuery({ ...cyclesQuery(organizationId), enabled: !!org });
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });
  const activePlans = (plans.data ?? []).filter((p) => p.status === "active");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState<CycleFrequency>("annual");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [launching, setLaunching] = useState<PerformanceCycle | null>(null);
  const [planId, setPlanId] = useState(NO_PLAN);

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => {
    toast.error(apiErrorMessage(e));
    return refresh();
  };

  const create = useMutation({
    mutationFn: createCycle,
    onSuccess: () => {
      toast.success(t("settings.cycleCreated"));
      setOpen(false);
      setName("");
      setPeriodStart("");
      setPeriodEnd("");
      setOpensAt("");
      setClosesAt("");
      return refresh();
    },
    onError,
  });

  // Opens the cycle, then one evaluation per present employee (06 §9). On an
  // already open cycle, only the missing evaluations are created.
  const launch = useMutation({
    mutationFn: async ({ cycle, plan }: { cycle: PerformanceCycle; plan?: string }) => {
      if (cycle.status === "draft") await openCycle(cycle.id);
      return openReviews({ cycleId: cycle.id, planId: plan }, newIdempotencyKey());
    },
    onSuccess: (result) => {
      toast.success(t("settings.cycleOpened", { count: result.created.length }));
      setLaunching(null);
      return refresh();
    },
    onError,
  });

  const close = useMutation({
    mutationFn: (cycle: PerformanceCycle) => closeCycle(cycle.id),
    onSuccess: refresh,
    onError,
  });

  const save = () => {
    if (!name.trim() || !periodStart || !periodEnd) {
      return toast.error(t("settings.planNameRequired"));
    }
    create.mutate({
      name: name.trim(),
      frequency: freq,
      periodStart,
      periodEnd,
      selfEvalOpensAt: toIso(opensAt),
      selfEvalClosesAt: toIso(closesAt),
    });
  };

  const startLaunch = (cycle: PerformanceCycle) => {
    setPlanId(activePlans[0]?.id ?? NO_PLAN);
    setLaunching(cycle);
  };

  const askClose = async (cycle: PerformanceCycle) => {
    const ok = await confirm({
      title: t("settings.closeCycleConfirm"),
      subtitle: cycle.name,
      description: t("settings.closeCycleConfirmDesc"),
      actionLabel: t("common.confirm"),
    });
    if (ok) close.mutate(cycle);
  };

  const list = cycles.data ?? [];

  return (
    <Card className="md:col-span-2">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t("settings.cyclesTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings.cyclesDesc")}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">{t("settings.newCycle")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.newCycleTitle")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cycle-name">{t("settings.cycleName")}</Label>
                    <Input
                      id="cycle-name"
                      value={name}
                      maxLength={200}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("settings.cycleNamePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cycle-frequency">{t("settings.cycleFrequency")}</Label>
                    <Select value={freq} onValueChange={(v) => setFreq(v as CycleFrequency)}>
                      <SelectTrigger id="cycle-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FREQUENCY_KEY) as CycleFrequency[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(FREQUENCY_KEY[f])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cycle-start">{t("settings.periodStartLong")}</Label>
                      <Input
                        id="cycle-start"
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cycle-end">{t("settings.periodEndLong")}</Label>
                      <Input
                        id="cycle-end"
                        type="date"
                        value={periodEnd}
                        min={periodStart || undefined}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cycle-opens">{t("settings.selfEvalOpen")}</Label>
                      <Input
                        id="cycle-opens"
                        type="datetime-local"
                        value={opensAt}
                        onChange={(e) => setOpensAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cycle-closes">{t("settings.selfEvalClose")}</Label>
                      <Input
                        id="cycle-closes"
                        type="datetime-local"
                        value={closesAt}
                        onChange={(e) => setClosesAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={save} disabled={create.isPending}>
                    {t("settings.createBtn")}
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog
          open={!!launching}
          onOpenChange={(v) => {
            if (!v) setLaunching(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {launching?.status === "open"
                  ? t("settings.generateReviewsTitle")
                  : t("settings.openCycleConfirm")}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm font-medium">{launching?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("settings.openCycleConfirmDesc")}
              </p>
              <div className="mt-4">
                <Label htmlFor="cycle-plan">{t("settings.reviewPlan")}</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger id="cycle-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PLAN}>{t("settings.reviewNoPlan")}</SelectItem>
                    {activePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{t("settings.reviewPlanHint")}</p>
              </div>
              <DialogActions>
                <Button variant="outline" onClick={() => setLaunching(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={launch.isPending}
                  onClick={() =>
                    launching &&
                    launch.mutate({
                      cycle: launching,
                      plan: planId === NO_PLAN ? undefined : planId,
                    })
                  }
                >
                  {launch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.confirm")}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("settings.noCycle")}</p>
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(FREQUENCY_KEY[c.frequency])} · {formatDate(c.periodStart)} →{" "}
                    {formatDate(c.periodEnd)} · {t(`settings.cycleStatuses.${c.status}`)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === "draft" && (
                    <Button size="sm" onClick={() => startLaunch(c)}>
                      {t("settings.openCycle")}
                    </Button>
                  )}
                  {c.status === "open" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startLaunch(c)}>
                        {t("settings.generateReviews")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void askClose(c)}>
                        {t("settings.finalize")}
                      </Button>
                    </>
                  )}
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
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState<PlanStatus>("active");

  const reset = () => {
    setName("");
    setPeriodStart("");
    setPeriodEnd("");
    setStatus("active");
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const create = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast.success(t("settings.planCreated"));
      setOpen(false);
      reset();
      return refresh();
    },
    onError,
  });
  const setPlanStatus = useMutation({
    mutationFn: ({ plan, next }: { plan: PerformancePlan; next: PlanStatus }) =>
      updatePlan(plan.id, { status: next }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (plan: PerformancePlan) => deletePlan(plan.id),
    onSuccess: refresh,
    onError,
  });

  const save = () => {
    if (!name.trim() || !periodStart || !periodEnd) {
      return toast.error(t("settings.planNameRequired"));
    }
    create.mutate({ name: name.trim(), periodStart, periodEnd, status });
  };

  const askRemove = async (plan: PerformancePlan) => {
    const ok = await confirm({
      title: t("settings.deletePlanConfirm"),
      subtitle: plan.name,
      description: t("settings.deletePlanConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(plan);
  };

  const list = plans.data ?? [];

  return (
    <Card className="md:col-span-2">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t("settings.performancePlansTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings.performancePlansDesc")}</p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">{t("settings.newPlan")}</Button>
            </DialogTrigger>
            <DialogContent
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{t("settings.newPlan")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="plan-name">
                      {t("settings.planName")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="plan-name"
                      value={name}
                      maxLength={120}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("settings.planNamePlaceholder")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="plan-start">{t("settings.periodStart")}</Label>
                      <Input
                        id="plan-start"
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan-end">{t("settings.periodEnd")}</Label>
                      <Input
                        id="plan-end"
                        type="date"
                        value={periodEnd}
                        min={periodStart || undefined}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="plan-status">{t("settings.status")}</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as PlanStatus)}>
                      <SelectTrigger id="plan-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PLAN_STATUS_KEY) as PlanStatus[]).map((st) => (
                          <SelectItem key={st} value={st}>
                            {t(PLAN_STATUS_KEY[st])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        reset();
                      }}
                    >
                      {t("settings.closeBtn")}
                    </Button>
                    <Button onClick={save} disabled={create.isPending}>
                      {t("settings.createBtn")}
                    </Button>
                  </div>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>

        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("settings.noPlan")}</p>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.periodStart)} → {formatDate(p.periodEnd)} ·{" "}
                    {t(PLAN_STATUS_KEY[p.status])}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.status !== "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlanStatus.mutate({ plan: p, next: "active" })}
                    >
                      {t("settings.activate")}
                    </Button>
                  )}
                  {p.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlanStatus.mutate({ plan: p, next: "closed" })}
                    >
                      {t("settings.finalize")}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("settings.deletePlanAria", { name: p.name })}
                    onClick={() => void askRemove(p)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
