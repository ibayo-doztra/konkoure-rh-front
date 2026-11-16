import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useRole } from "@/hooks/useRole";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/_authenticated/app/performance/goals")({
  component: GoalsPage,
});

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  not_started: "outline",
  in_progress: "secondary",
  late: "destructive",
  achieved: "default",
};

const PLAN_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "outline",
  closed: "secondary",
};

const schema = z.object({
  title: z.string().trim().min(3, "Titre : 3 caractères minimum").max(200),
  measurement: z.string().trim().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "late", "achieved"]),
  owner_id: z.string().uuid().nullable().optional(),
  plan_id: z.string().uuid(),
});

type FormState = {
  title: string;
  measurement: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "not_started" | "in_progress" | "late" | "achieved";
  owner_id: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  measurement: "",
  description: "",
  start_date: "",
  end_date: "",
  status: "not_started",
  owner_id: "",
};

const NO_PLAN_KEY = "__none__";
const NO_OWNER_KEY = "__nobody__";

function GoalsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const { myEmployee, ensureMyEmployee } = useMyEmployee();
  const { role } = useRole();
  const canAssignOwner = role === "owner" || role === "hr_admin" || role === "manager";

  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [filterPlan, setFilterPlan] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [evaluatingKey, setEvaluatingKey] = useState<string | null>(null);

  const load = async () => {
    if (!org) return;
    const [g, e, p, r] = await Promise.all([
      pendingQuery("GET /org/performance/goals"),
      pendingQuery("GET /org/employees"),
      pendingQuery("GET /org/performance/plans"),
      pendingQuery("GET /org/performance/reviews"),
    ]);
    setItems(g.data ?? []);
    setEmployees(e.data ?? []);
    setPlans((p.data as any[]) ?? []);
    setReviews((r.data as any[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, [org?.id]);

  const empById = useMemo(
    () => Object.fromEntries(employees.map((x) => [x.id, x])),
    [employees],
  );
  const planById = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);
  const activePlans = useMemo(() => plans.filter((p) => p.status === "active"), [plans]);
  const reviewByKey = useMemo(
    () => Object.fromEntries(reviews.map((r) => [`${r.plan_id}::${r.employee_id}`, r])),
    [reviews],
  );

  const filteredItems = useMemo(() => {
    if (filterPlan === "all") return items;
    if (filterPlan === "none") return items.filter((g) => !g.plan_id);
    return items.filter((g) => g.plan_id === filterPlan);
  }, [items, filterPlan]);

  // Group by (plan, owner)
  const groups = useMemo(() => {
    const map = new Map<string, { planId: string | null; ownerId: string | null; goals: any[] }>();
    for (const g of filteredItems) {
      const planId = g.plan_id ?? null;
      const ownerId = g.owner_id ?? g.employee_id ?? null;
      const key = `${planId ?? NO_PLAN_KEY}::${ownerId ?? NO_OWNER_KEY}`;
      if (!map.has(key)) map.set(key, { planId, ownerId, goals: [] });
      map.get(key)!.goals.push(g);
    }
    const list = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
    // Sort: active plans first, then by plan period_start desc, then "no plan" last
    list.sort((a, b) => {
      const pa = a.planId ? planById[a.planId] : null;
      const pb = b.planId ? planById[b.planId] : null;
      if (!pa && pb) return 1;
      if (pa && !pb) return -1;
      if (pa && pb) {
        const aActive = pa.status === "active" ? 0 : 1;
        const bActive = pb.status === "active" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return (pb.period_start ?? "").localeCompare(pa.period_start ?? "");
      }
      return 0;
    });
    return list;
  }, [filteredItems, planById]);



  const closeModal = () => {
    setOpen(false);
    setStep(1);
    setSelectedPlanId("");
    setForm(EMPTY_FORM);
  };

  const datesInvalid = !!(
    form.start_date &&
    form.end_date &&
    form.end_date < form.start_date
  );

  const save = async () => {
    if (!org) return;
    if (datesInvalid) {
      return toast.error(t("goals.dateOrderError"));
    }
    const parsed = schema.safeParse({
      title: form.title,
      measurement: form.measurement || undefined,
      description: form.description || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      status: form.status,
      owner_id: (canAssignOwner ? form.owner_id : "") || null,
      plan_id: selectedPlanId,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    // Si "Moi-même" est choisi, le propriétaire est l'utilisateur courant.
    // S'il n'a pas encore de fiche employé, on la crée automatiquement.
    let ownerEmpId = parsed.data.owner_id ?? null;
    if (!ownerEmpId) {
      ownerEmpId = await ensureMyEmployee();
      if (!ownerEmpId) return; // erreur déjà affichée
    }

    const createdById = myEmployee?.id ?? ownerEmpId;

    const { error } = await pendingQuery("POST /org/performance/goals");
    if (error) return toast.error(error.message);
    toast.success(t("goals.createdSuccess"));
    closeModal();
    void load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await pendingQuery("PATCH /org/performance/goals");
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: t("goals.deleteConfirm"), description: t("goals.deleteConfirmDesc"), actionLabel: t("common.delete"), actionVariant: "destructive" }))) return;
    const { error } = await pendingQuery("DELETE /org/performance/goals");
    if (error) return toast.error(error.message);
    void load();
  };

  const toggle = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const startEvaluation = async (group: { key: string; planId: string | null; ownerId: string | null; goals: any[] }) => {
    const { key, planId, ownerId } = group;
    if (!ownerId) {
      return toast.error(t("goals.noOwnerError"));
    }
    if (!planId) {
      return toast.error(t("goals.noPlanError"));
    }
    setEvaluatingKey(key);
    try {
      navigate({
        to: "/app/performance/reviews/new/$planId/$employeeId",
        params: { planId, employeeId: ownerId },
      });
    } finally {
      setEvaluatingKey(null);
    }
  };


  const canSubmit = form.title.trim().length >= 3;
  const selectedPlan = selectedPlanId ? planById[selectedPlanId] : null;

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("goals.title")}
        description={t("goals.description")}
        actions={
          <>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("goals.filterByPlan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("goals.allPlans")}</SelectItem>
                <SelectItem value="none">{t("goals.noPlan")}</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full sm:w-auto" onClick={() => { setOpen(true); setStep(1); }}>
              <Plus className="mr-2 h-4 w-4" />
              {t("goals.newGoal")}
            </Button>
          </>
        }
      />

      <Dialog open={open} onOpenChange={(v) => { if (!v) return; setOpen(v); }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{step === 1 ? t("goals.selectPlanTitle") : t("goals.newGoalTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {step === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("goals.selectPlanDesc")}
                </p>
                {activePlans.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm">{t("goals.noActivePlan")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("goals.noActivePlanHint")}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link to="/app/settings">{t("performance.settingsLink")}</Link>
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Label>
                      {t("goals.plan")} <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("goals.choosePlan")} />
                      </SelectTrigger>
                      <SelectContent>
                        {activePlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({p.period_start} → {p.period_end})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeModal}>{t("goals.close")}</Button>
                  <Button onClick={() => setStep(2)} disabled={!selectedPlanId}>
                    {t("goals.continue")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("goals.plan")} : </span>
                    <span className="font-medium">{selectedPlan?.name}</span>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setStep(1)}>
                    {t("goals.change")}
                  </Button>
                </div>
                <div>
                  <Label>
                    {t("goals.goalTitle")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.title}
                    maxLength={200}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("goals.measurement")}</Label>
                  <Input
                    value={form.measurement}
                    maxLength={500}
                    placeholder={t("goals.measurementPlaceholder")}
                    onChange={(e) => setForm({ ...form, measurement: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("goals.description2")}</Label>
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("goals.startDate")}</Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("goals.endDate")}</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      min={form.start_date || undefined}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                    {datesInvalid && (
                      <p className="mt-1 text-xs text-destructive">
                        {t("goals.dateOrderError")}
                      </p>
                    )}
                  </div>
                </div>

                <div className={canAssignOwner ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                  <div>
                    <Label>{t("goals.status")}</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v: any) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(STATUS_VARIANTS).map((k) => (
                          <SelectItem key={k} value={k}>
                            {t(`goals.statuses.${k}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {canAssignOwner && (
                  <div>
                    <Label>{t("goals.owner")}</Label>
                    <Select
                      value={form.owner_id || "me"}
                      onValueChange={(v) =>
                        setForm({ ...form, owner_id: v === "me" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="me">{t("goals.myself")}</SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeModal}>{t("goals.close")}</Button>
                  <Button onClick={save} disabled={!canSubmit || datesInvalid}>
                    {t("goals.createGoal")}
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>


      <div className="grid gap-3">
        {groups.map((group) => {
          const plan = group.planId ? planById[group.planId] : null;
          const owner = group.ownerId ? empById[group.ownerId] : null;
          const planStatus = plan ? plan.status : null;
          const counts = group.goals.reduce<Record<string, number>>((acc, g) => {
            acc[g.status] = (acc[g.status] ?? 0) + 1;
            return acc;
          }, {});
          const isOpen = expanded[group.key] ?? (filterPlan !== "all" && filterPlan !== "none");
          const existingReview = group.planId && group.ownerId ? reviewByKey[`${group.planId}::${group.ownerId}`] : null;
          const isSubmitted = existingReview?.status === "submitted";
          return (
            <Card key={group.key}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{plan ? plan.name : t("goals.noPlan")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {planStatus && (
                        <Badge variant={PLAN_STATUS_VARIANTS[planStatus] ?? "outline"}>{t(`goals.planStatuses.${planStatus}`)}</Badge>
                      )}
                      <Badge variant="outline" className="max-w-full truncate">
                        {owner ? `${owner.first_name} ${owner.last_name}` : t("goals.withoutOwner")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {plan && (
                        <span className="whitespace-nowrap">
                          {plan.period_start} → {plan.period_end}
                        </span>
                      )}
                      <span className="whitespace-nowrap">
                        {t("goals.objectivesCount", { count: group.goals.length })}
                      </span>
                      {Object.entries(counts).map(([k, n]) => (
                        <span key={k} className="whitespace-nowrap">
                          {n} {(t(`goals.statuses.${k}`) as string).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0 sm:items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center sm:w-auto"
                      onClick={() => toggle(group.key)}
                    >
                      {isOpen ? (
                        <ChevronDown className="mr-1 h-4 w-4" />
                      ) : (
                        <ChevronRight className="mr-1 h-4 w-4" />
                      )}
                      {isOpen ? t("goals.hide") : t("goals.showGoals")}
                    </Button>
                    {isSubmitted && existingReview ? (
                      <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
                        <Link to="/app/performance/reviews/$id" params={{ id: existingReview.id }}>
                          <ClipboardCheck className="mr-1 h-4 w-4" />
                          {t("goals.view")}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={() => startEvaluation(group)}
                        disabled={!group.ownerId || group.goals.length === 0 || evaluatingKey === group.key}
                      >
                        <ClipboardCheck className="mr-1 h-4 w-4" />
                        {evaluatingKey === group.key ? t("goals.starting") : t("goals.evaluate")}
                      </Button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 grid gap-2 border-t pt-4">
                    {group.goals.map((g) => {
                      const statusVariant = STATUS_VARIANTS[g.status] ?? STATUS_VARIANTS.not_started;
                      return (
                        <div key={g.id} className="rounded-md border bg-background p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="min-w-0 break-words font-medium">{g.title}</p>
                                <Badge variant={statusVariant}>{t(`goals.statuses.${g.status}`)}</Badge>
                              </div>
                              {g.measurement && (
                                <p className="mt-1 break-words text-sm">
                                  <span className="text-muted-foreground">{t("goals.measurementLabel")}</span>
                                  {g.measurement}
                                </p>
                              )}
                              {g.description && (
                                <p className="mt-1 break-words text-sm text-muted-foreground">
                                  {g.description}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {g.start_date && <span className="whitespace-nowrap">{t("goals.startLabel")}{g.start_date}</span>}
                                {g.end_date && <span className="whitespace-nowrap">{t("goals.endLabel")}{g.end_date}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:shrink-0">
                              <Select
                                value={g.status}
                                onValueChange={(v) => updateStatus(g.id, v)}
                              >
                                <SelectTrigger className="h-8 w-full sm:w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(STATUS_VARIANTS).map((k) => (
                                    <SelectItem key={k} value={k}>
                                      {t(`goals.statuses.${k}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="shrink-0"
                                aria-label={t("goals.deleteGoalAria")}
                                onClick={() => remove(g.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("goals.empty")}</p>
        )}
      </div>
    </div>
  );
}
