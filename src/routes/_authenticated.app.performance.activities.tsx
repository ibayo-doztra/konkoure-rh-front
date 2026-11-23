import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import {
  ACTIVITY_STATUSES,
  activitiesQuery,
  createActivity,
  deleteActivity,
  goalsQuery,
  performanceKey,
  updateActivity,
  type ActivityStatus,
  type GoalActivity,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/performance/activities")({
  component: ActivitiesPage,
});

const EMPTY_FORM = { goalId: "", title: "", plannedDate: "" };

function ActivitiesPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();

  const goals = useQuery({ ...goalsQuery(organizationId), enabled: !!org });
  const activities = useQuery({ ...activitiesQuery(organizationId), enabled: !!org });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const schema = useMemo(
    () =>
      z.object({
        goalId: z.string().uuid(t("activities.errors.selectGoal")),
        title: z
          .string()
          .trim()
          .min(3, t("activities.errors.titleMin"))
          .max(200, t("activities.errors.titleMax")),
        plannedDate: z.string().optional(),
      }),
    [t],
  );

  // A cancelled goal no longer progresses: no new activity on it.
  const goalList = useMemo(() => goals.data ?? [], [goals.data]);
  const openGoals = useMemo(() => goalList.filter((g) => g.status !== "cancelled"), [goalList]);
  const goalTitle = useMemo(() => new Map(goalList.map((g) => [g.id, g.title])), [goalList]);
  const items = activities.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const create = useMutation({
    mutationFn: ({ goalId, ...input }: z.infer<typeof schema>) => createActivity(goalId, input),
    onSuccess: () => {
      toast.success(t("activities.createdSuccess"));
      setOpen(false);
      setForm(EMPTY_FORM);
      return refresh();
    },
    onError,
  });
  const setStatus = useMutation({
    mutationFn: ({ activity, status }: { activity: GoalActivity; status: ActivityStatus }) =>
      updateActivity(activity.goalId, activity.id, { status }),
    onSettled: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (activity: GoalActivity) => deleteActivity(activity.goalId, activity.id),
    onSuccess: refresh,
    onError,
  });

  const save = () => {
    const parsed = schema.safeParse({
      goalId: form.goalId,
      title: form.title,
      plannedDate: form.plannedDate || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  };

  const askRemove = async (activity: GoalActivity) => {
    const ok = await confirm({
      title: t("activities.deleteConfirm"),
      description: t("activities.deleteConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(activity);
  };

  const canSubmit = !!form.goalId && form.title.trim().length >= 3 && !create.isPending;
  const noGoal = goals.isSuccess && openGoals.length === 0;

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("activities.title")}
        description={t("activities.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setForm(EMPTY_FORM);
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={openGoals.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                {t("activities.newActivity")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("activities.newActivity")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="activity-goal">
                      {t("activities.linkedGoal")} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.goalId}
                      onValueChange={(v) => setForm({ ...form, goalId: v })}
                    >
                      <SelectTrigger id="activity-goal">
                        <SelectValue placeholder={t("activities.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {openGoals.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="activity-title">
                      {t("activities.activityTitle")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="activity-title"
                      value={form.title}
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="activity-date">{t("activities.plannedDate")}</Label>
                    <Input
                      id="activity-date"
                      type="date"
                      value={form.plannedDate}
                      onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
                    />
                  </div>
                  <Button className="w-full" onClick={save} disabled={!canSubmit}>
                    {t("activities.create")}
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      {noGoal && (
        <p className="mb-4 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("activities.createNeedsGoal")}
        </p>
      )}
      {activities.isError && (
        <p className="mb-4 text-center text-sm text-destructive">
          {apiErrorMessage(activities.error)}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {ACTIVITY_STATUSES.map((s) => {
          const column = items.filter((i) => i.status === s);
          return (
            <section
              key={s}
              className="rounded-lg border bg-muted/30 p-3"
              aria-label={t(`activities.statuses.${s}`)}
            >
              <h3 className="mb-2 text-sm font-semibold">
                {t(`activities.statuses.${s}`)}{" "}
                <span className="text-muted-foreground">({column.length})</span>
              </h3>
              <div className="grid gap-2">
                {column.map((a) => (
                  <Card key={a.id} data-testid="activity-card">
                    <CardContent className="p-3">
                      <p className="break-words text-sm font-medium">{a.title}</p>
                      {goalTitle.has(a.goalId) && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {goalTitle.get(a.goalId)}
                        </Badge>
                      )}
                      {a.plannedDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("activities.plannedDate")} : {a.plannedDate}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1">
                        <Select
                          value={a.status}
                          onValueChange={(v) =>
                            setStatus.mutate({ activity: a, status: v as ActivityStatus })
                          }
                        >
                          <SelectTrigger
                            className="h-7 text-xs"
                            aria-label={t("activities.statusAria", { title: a.title })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIVITY_STATUSES.map((st) => (
                              <SelectItem key={st} value={st}>
                                {t(`activities.statuses.${st}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("activities.deleteAria", { title: a.title })}
                          onClick={() => void askRemove(a)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {column.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {t("activities.empty")}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
