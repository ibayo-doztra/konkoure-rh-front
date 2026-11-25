import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api/client";
import {
  achievementsQuery,
  createAchievement,
  deleteAchievement,
  goalsQuery,
  performanceKey,
  type Achievement,
} from "@/lib/api/performance";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { PageHeader } from "@/components/PageHeader";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/performance/achievements")({
  component: AchievementsPage,
});

const NO_GOAL = "none";
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ title: "", impact: "", goalId: NO_GOAL, achievedAt: today() });

function AchievementsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const { user } = useAuth();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const access = usePerformanceAccess();
  const goals = useQuery({ ...goalsQuery(organizationId), enabled: !!org });
  const achievements = useQuery({ ...achievementsQuery(organizationId), enabled: !!org });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(3, t("achievements.errors.titleMin"))
          .max(200, t("achievements.errors.titleMax")),
        impact: z.string().trim().max(500).optional(),
        achievedAt: z.string().min(1, t("achievements.errors.dateRequired")),
      }),
    [t],
  );

  const goalList = goals.data ?? [];
  // An achievement is the reader's own: only his goals can be linked (06 §9).
  const myGoals = goalList.filter((g) => g.employeeId === access.myEmployeeId);
  const items = [...(achievements.data ?? [])].sort((a, b) =>
    b.achievedAt.localeCompare(a.achievedAt),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const create = useMutation({
    mutationFn: createAchievement,
    onSuccess: () => {
      toast.success(t("achievements.savedSuccess"));
      setOpen(false);
      setForm(emptyForm());
      return refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (a: Achievement) => deleteAchievement(a.id),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const save = () => {
    const parsed = schema.safeParse({
      title: form.title,
      impact: form.impact || undefined,
      achievedAt: form.achievedAt,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!access.myEmployeeId) return toast.error(t("achievements.errors.noEmployeeRecord"));
    create.mutate({
      title: parsed.data.title,
      impact: parsed.data.impact,
      achievedAt: new Date(`${parsed.data.achievedAt}T12:00:00`).toISOString(),
      goalId: form.goalId === NO_GOAL ? undefined : form.goalId,
    });
  };

  const askRemove = async (a: Achievement) => {
    const ok = await confirm({
      title: t("achievements.deleteConfirm"),
      description: t("achievements.deleteConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(a);
  };

  const canSubmit = form.title.trim().length >= 3 && !create.isPending;

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("achievements.title")}
        description={t("achievements.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setForm(emptyForm());
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("achievements.newAchievement")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("achievements.newAchievement")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="achievement-title">
                      {t("achievements.achievementTitle")}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="achievement-title"
                      value={form.title}
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="achievement-date">
                      {t("achievements.achievedAt")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="achievement-date"
                      type="date"
                      value={form.achievedAt}
                      max={today()}
                      onChange={(e) => setForm({ ...form, achievedAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="achievement-impact">{t("achievements.impact")}</Label>
                    <Textarea
                      id="achievement-impact"
                      rows={3}
                      maxLength={500}
                      value={form.impact}
                      onChange={(e) => setForm({ ...form, impact: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="achievement-goal">{t("achievements.linkedGoal")}</Label>
                    <Select
                      value={form.goalId}
                      onValueChange={(v) => setForm({ ...form, goalId: v })}
                    >
                      <SelectTrigger id="achievement-goal">
                        <SelectValue placeholder={t("achievements.none")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_GOAL}>{t("achievements.none")}</SelectItem>
                        {myGoals.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={save} disabled={!canSubmit}>
                    {t("achievements.save")}
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-3">
        {items.map((a) => {
          const goal = a.goalId ? goalList.find((g) => g.id === a.goalId) : undefined;
          const canDelete = access.isAdmin || (!!user && a.createdBy === user.id);
          const isMine = access.isSelf(a.employeeId);
          return (
            <Card key={a.id} data-testid="achievement-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="break-words font-semibold">{a.title}</p>
                      {goal && <Badge variant="outline">{goal.title}</Badge>}
                    </div>
                    {a.impact && <p className="mt-1 text-sm text-muted-foreground">{a.impact}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(a.achievedAt)}
                      {!isMine && ` · ${access.nameOf(a.employeeId) ?? "—"}`}
                    </p>
                  </div>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("achievements.deleteAria", { title: a.title })}
                      onClick={() => void askRemove(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!achievements.isPending && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {achievements.isError ? apiErrorMessage(achievements.error) : t("achievements.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
