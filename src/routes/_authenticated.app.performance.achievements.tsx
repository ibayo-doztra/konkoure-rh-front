import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useMyEmployee } from "@/hooks/useMyEmployee";
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
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/_authenticated/app/performance/achievements")({
  component: AchievementsPage,
});

function useAchievementSchema(t: (k: string) => string) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(3, t("achievements.errors.titleMin"))
      .max(200, t("achievements.errors.titleMax")),
    impact: z.string().trim().max(500).optional(),
    goal_id: z.string().uuid().nullable().optional(),
  });
}

function AchievementsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const schema = useAchievementSchema(t);
  const { org } = useOrg();
  const { requireEmployee } = useMyEmployee();
  const [goals, setGoals] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const empty = { title: "", impact: "", goal_id: "" };
  const [form, setForm] = useState(empty);

  const load = async () => {
    if (!org) return;
    const [{ data: gs }, { data: ach }] = await Promise.all([
      pendingQuery("GET /org/performance/goals"),
      pendingQuery("GET /org/performance/achievements"),
    ]);
    setGoals(gs ?? []);
    setItems(ach ?? []);
  };
  useEffect(() => {
    void load();
  }, [org]);

  const save = async () => {
    if (!org) return;
    const parsed = schema.safeParse({
      title: form.title,
      impact: form.impact || undefined,
      goal_id: form.goal_id || null,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const empId = await requireEmployee();
    if (empId === false) return;
    const { error } = await pendingQuery("POST /org/performance/achievements");
    if (error) return toast.error(error.message);
    toast.success(t("achievements.savedSuccess"));
    setOpen(false);
    setForm(empty);
    void load();
  };

  const remove = async (id: string) => {
    if (
      !(await confirm({
        title: t("achievements.deleteConfirm"),
        description: t("achievements.deleteConfirmDesc"),
        actionLabel: t("common.delete"),
        actionVariant: "destructive",
      }))
    )
      return;
    const { error } = await pendingQuery("DELETE /org/performance/achievements");
    if (error) return toast.error(error.message);
    void load();
  };

  const canSubmit = form.title.trim().length >= 3;

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
              if (!v) setForm(empty);
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
                    <Label>
                      {t("achievements.achievementTitle")}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.title}
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("achievements.impact")}</Label>
                    <Textarea
                      rows={3}
                      maxLength={500}
                      value={form.impact}
                      onChange={(e) => setForm({ ...form, impact: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("achievements.linkedGoal")}</Label>
                    <Select
                      value={form.goal_id || "none"}
                      onValueChange={(v) => setForm({ ...form, goal_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("achievements.none")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("achievements.none")}</SelectItem>
                        {goals.map((g) => (
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
          const goal = goals.find((g) => g.id === a.goal_id);
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{a.title}</p>
                      {goal && <Badge variant="outline">{goal.title}</Badge>}
                    </div>
                    {a.impact && <p className="mt-1 text-sm text-muted-foreground">{a.impact}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(a.achieved_at)}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("achievements.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
