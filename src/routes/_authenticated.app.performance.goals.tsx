import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createGoal,
  deleteGoal,
  GOAL_STATUS_VARIANT,
  goalsQuery,
  performanceKey,
  plansQuery,
  updateGoal,
  updateGoalProgress,
  WRITABLE_GOAL_STATUSES,
  type Goal,
  type GoalStatus,
  type PlanStatus,
  type WritableGoalStatus,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

export const Route = createFileRoute("/_authenticated/app/performance/goals")({
  component: GoalsPage,
});

const PLAN_STATUS_VARIANTS: Record<PlanStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "outline",
  closed: "secondary",
};

type FormState = {
  title: string;
  measurement: string;
  description: string;
  startDate: string;
  dueDate: string;
  weight: string;
  /** Empty: the goal is for the reader. */
  employeeId: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  measurement: "",
  description: "",
  startDate: "",
  dueDate: "",
  weight: "",
  employeeId: "",
};

const NO_PLAN_KEY = "__none__";

interface GoalGroup {
  key: string;
  planId: string | null;
  employeeId: string;
  goals: Goal[];
}

function GoalsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const access = usePerformanceAccess();
  const { canProgress, nameOf, myEmployeeId } = access;
  // 07 §5.2: only managers and administrators pick the holder; an employee creates for himself.
  const canAssignHolder = access.isAdmin || access.isManager;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const goals = useQuery({ ...goalsQuery(organizationId), enabled: !!org });
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });

  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(3, t("goals.errors.titleMin")).max(200),
        measurement: z.string().trim().max(500).optional(),
        description: z.string().trim().max(2000).optional(),
        weight: z.number().int().min(0).max(100, t("goals.errors.weightRange")).optional(),
      }),
    [t],
  );

  const planList = useMemo(() => plans.data ?? [], [plans.data]);
  const planById = useMemo(() => new Map(planList.map((p) => [p.id, p])), [planList]);
  const activePlans = useMemo(() => planList.filter((p) => p.status === "active"), [planList]);
  const assignable = useMemo(
    () => access.employees.filter((e) => e.id !== myEmployeeId),
    [access.employees, myEmployeeId],
  );

  const filteredItems = useMemo(() => {
    const items = goals.data ?? [];
    if (filterPlan === "all") return items;
    if (filterPlan === "none") return items.filter((g) => !g.planId);
    return items.filter((g) => g.planId === filterPlan);
  }, [goals.data, filterPlan]);

  // Grouped by (plan, holder): one evaluation per employee and plan.
  const groups = useMemo(() => {
    const map = new Map<string, GoalGroup>();
    for (const g of filteredItems) {
      const key = `${g.planId ?? NO_PLAN_KEY}::${g.employeeId}`;
      if (!map.has(key))
        map.set(key, { key, planId: g.planId, employeeId: g.employeeId, goals: [] });
      map.get(key)!.goals.push(g);
    }
    // Active plans first, then the most recent period, goals without a plan last.
    return Array.from(map.values()).sort((a, b) => {
      const pa = a.planId ? planById.get(a.planId) : undefined;
      const pb = b.planId ? planById.get(b.planId) : undefined;
      if (!pa && pb) return 1;
      if (pa && !pb) return -1;
      if (pa && pb) {
        const aActive = pa.status === "active" ? 0 : 1;
        const bActive = pb.status === "active" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return pb.periodStart.localeCompare(pa.periodStart);
      }
      return 0;
    });
  }, [filteredItems, planById]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const create = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      toast.success(t("goals.createdSuccess"));
      closeModal();
      return refresh();
    },
    onError,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WritableGoalStatus }) =>
      updateGoal(id, { status }),
    onSettled: refresh,
    onError,
  });
  const setProgress = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      updateGoalProgress(id, progress),
    onSettled: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: refresh,
    onError,
  });

  function closeModal() {
    setOpen(false);
    setStep(1);
    setSelectedPlanId("");
    setForm(EMPTY_FORM);
  }

  const datesInvalid = !!(form.startDate && form.dueDate && form.dueDate < form.startDate);

  const save = () => {
    if (datesInvalid) return toast.error(t("goals.dateOrderError"));
    const parsed = schema.safeParse({
      title: form.title,
      measurement: form.measurement || undefined,
      description: form.description || undefined,
      weight: form.weight === "" ? undefined : Number(form.weight),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const holder = canAssignHolder && form.employeeId ? form.employeeId : undefined;
    if (!holder && !myEmployeeId) return toast.error(t("goals.errors.noEmployeeRecord"));
    create.mutate({
      ...parsed.data,
      employeeId: holder,
      planId: selectedPlanId,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
    });
  };

  const askRemove = async (id: string) => {
    const ok = await confirm({
      title: t("goals.deleteConfirm"),
      description: t("goals.deleteConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(id);
  };

  const commitProgress = (goal: Goal, raw: string) => {
    const progress = Math.round(Number(raw));
    if (raw === "" || Number.isNaN(progress) || progress === goal.progress) return;
    if (progress < 0 || progress > 100) return toast.error(t("goals.errors.progressRange"));
    setProgress.mutate({ id: goal.id, progress });
  };

  const startEvaluation = (group: GoalGroup) => {
    if (!group.planId) return toast.error(t("goals.noPlanError"));
    void navigate({
      to: "/app/performance/reviews/new/$planId/$employeeId",
      params: { planId: group.planId, employeeId: group.employeeId },
    });
  };

  const toggle = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));
  const canSubmit = form.title.trim().length >= 3 && !create.isPending;
  const selectedPlan = selectedPlanId ? planById.get(selectedPlanId) : undefined;
  const loading = goals.isPending || plans.isPending;

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("goals.title")}
        description={t("goals.description")}
        actions={
          <>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-full sm:w-48" aria-label={t("goals.filterByPlan")}>
                <SelectValue placeholder={t("goals.filterByPlan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("goals.allPlans")}</SelectItem>
                <SelectItem value="none">{t("goals.noPlan")}</SelectItem>
                {planList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setOpen(true);
                setStep(1);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("goals.newGoal")}
            </Button>
          </>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) setOpen(v);
        }}
      >
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? t("goals.selectPlanTitle") : t("goals.newGoalTitle")}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {step === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("goals.selectPlanDesc")}</p>
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
                    <Label htmlFor="goal-plan">
                      {t("goals.plan")} <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                      <SelectTrigger id="goal-plan">
                        <SelectValue placeholder={t("goals.choosePlan")} />
                      </SelectTrigger>
                      <SelectContent>
                        {activePlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({p.periodStart} → {p.periodEnd})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeModal}>
                    {t("goals.close")}
                  </Button>
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
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => setStep(1)}
                  >
                    {t("goals.change")}
                  </Button>
                </div>
                <div>
                  <Label htmlFor="goal-title">
                    {t("goals.goalTitle")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="goal-title"
                    value={form.title}
                    maxLength={200}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="goal-measurement">{t("goals.measurement")}</Label>
                  <Input
                    id="goal-measurement"
                    value={form.measurement}
                    maxLength={500}
                    placeholder={t("goals.measurementPlaceholder")}
                    onChange={(e) => setForm({ ...form, measurement: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="goal-description">{t("goals.description2")}</Label>
                  <Textarea
                    id="goal-description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="goal-start">{t("goals.startDate")}</Label>
                    <Input
                      id="goal-start"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="goal-due">{t("goals.endDate")}</Label>
                    <Input
                      id="goal-due"
                      type="date"
                      value={form.dueDate}
                      min={form.startDate || undefined}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    />
                    {datesInvalid && (
                      <p className="mt-1 text-xs text-destructive">{t("goals.dateOrderError")}</p>
                    )}
                  </div>
                </div>

                <div className={canAssignHolder ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
                  <div>
                    <Label htmlFor="goal-weight">{t("goals.weight")}</Label>
                    <Input
                      id="goal-weight"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={form.weight}
                      placeholder="0 – 100"
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("goals.weightHint")}</p>
                  </div>
                  {canAssignHolder && (
                    <div>
                      <Label htmlFor="goal-holder">{t("goals.owner")}</Label>
                      <Select
                        value={form.employeeId || "me"}
                        onValueChange={(v) => setForm({ ...form, employeeId: v === "me" ? "" : v })}
                      >
                        <SelectTrigger id="goal-holder">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="me">{t("goals.myself")}</SelectItem>
                          {assignable.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeModal}>
                    {t("goals.close")}
                  </Button>
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
          const plan = group.planId ? planById.get(group.planId) : undefined;
          const holderName = nameOf(group.employeeId);
          const counts = group.goals.reduce<Partial<Record<GoalStatus, number>>>((acc, g) => {
            acc[g.status] = (acc[g.status] ?? 0) + 1;
            return acc;
          }, {});
          const isOpen = expanded[group.key] ?? (filterPlan !== "all" && filterPlan !== "none");
          return (
            <Card key={group.key}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{plan ? plan.name : t("goals.noPlan")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {plan && (
                        <Badge variant={PLAN_STATUS_VARIANTS[plan.status]}>
                          {t(`goals.planStatuses.${plan.status}`)}
                        </Badge>
                      )}
                      <Badge variant="outline" className="max-w-full truncate">
                        {holderName || t("goals.withoutOwner")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {plan && (
                        <span className="whitespace-nowrap">
                          {plan.periodStart} → {plan.periodEnd}
                        </span>
                      )}
                      <span className="whitespace-nowrap">
                        {t("goals.objectivesCount", { count: group.goals.length })}
                      </span>
                      {Object.entries(counts).map(([k, n]) => (
                        <span key={k} className="whitespace-nowrap">
                          {n} {t(`goals.statuses.${k}`).toLowerCase()}
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
                    <Button
                      size="sm"
                      className="w-full justify-center sm:w-auto"
                      onClick={() => startEvaluation(group)}
                      disabled={!group.planId}
                    >
                      <ClipboardCheck className="mr-1 h-4 w-4" />
                      {t("goals.evaluate")}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 grid gap-2 border-t pt-4">
                    {group.goals.map((g) => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        canProgress={canProgress(g.employeeId)}
                        onStatus={(status) => setStatus.mutate({ id: g.id, status })}
                        onProgress={(raw) => commitProgress(g, raw)}
                        onDelete={() => void askRemove(g.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!loading && groups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {goals.isError ? apiErrorMessage(goals.error) : t("goals.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  canProgress,
  onStatus,
  onProgress,
  onDelete,
}: {
  goal: Goal;
  canProgress: boolean;
  onStatus: (status: WritableGoalStatus) => void;
  onProgress: (raw: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const writable = (WRITABLE_GOAL_STATUSES as readonly string[]).includes(goal.status);
  const cancelled = goal.status === "cancelled";
  return (
    <div className="rounded-md border bg-background p-3" data-testid="goal-row">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-medium">{goal.title}</p>
            <Badge variant={GOAL_STATUS_VARIANT[goal.status]}>
              {t(`goals.statuses.${goal.status}`)}
            </Badge>
            {goal.weight > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("goals.weightValue", { weight: goal.weight })}
              </span>
            )}
          </div>
          {goal.measurement && (
            <p className="mt-1 break-words text-sm">
              <span className="text-muted-foreground">{t("goals.measurementLabel")}</span>
              {goal.measurement}
            </p>
          )}
          {goal.description && (
            <p className="mt-1 break-words text-sm text-muted-foreground">{goal.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {goal.startDate && (
              <span className="whitespace-nowrap">
                {t("goals.startLabel")}
                {goal.startDate}
              </span>
            )}
            {goal.dueDate && (
              <span className="whitespace-nowrap">
                {t("goals.endLabel")}
                {goal.dueDate}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={goal.progress} className="h-2 flex-1" />
            {canProgress ? (
              <Input
                key={goal.progress}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={goal.progress}
                disabled={cancelled}
                aria-label={t("goals.progressAria", { title: goal.title })}
                className="h-8 w-20"
                onBlur={(e) => onProgress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            ) : (
              <span className="w-20 text-right text-sm tabular-nums">{goal.progress}</span>
            )}
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Select value={goal.status} onValueChange={(v) => onStatus(v as WritableGoalStatus)}>
            <SelectTrigger
              className="h-8 w-full sm:w-36"
              aria-label={t("goals.statusAria", { title: goal.title })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!writable && (
                <SelectItem value={goal.status} disabled>
                  {t(`goals.statuses.${goal.status}`)}
                </SelectItem>
              )}
              {WRITABLE_GOAL_STATUSES.map((k) => (
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
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
