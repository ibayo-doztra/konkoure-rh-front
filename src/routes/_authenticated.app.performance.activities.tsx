import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/_authenticated/app/performance/activities")({
  component: ActivitiesPage,
});

const STATUSES = ["planned", "in_progress", "done"] as const;

function useActivitySchema(t: (k: string) => string) {
  return z.object({
    goal_id: z.string().uuid(t("activities.errors.selectGoal")),
    title: z.string().trim().min(3, t("activities.errors.titleMin")).max(200, t("activities.errors.titleMax")),
    planned_date: z.string().optional(),
  });
}

function ActivitiesPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const schema = useActivitySchema(t);
  const STATUS_LABELS: Record<string, string> = {
    planned: t("activities.statuses.planned"),
    in_progress: t("activities.statuses.in_progress"),
    done: t("activities.statuses.done"),
  };
  const { org } = useOrg();
  const { requireEmployee } = useMyEmployee();
  const [goals, setGoals] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const empty = { goal_id: "", title: "", planned_date: "" };
  const [form, setForm] = useState(empty);

  const load = async () => {
    if (!org) return;
    const [{ data: gs }, { data: acts }] = await Promise.all([
      pendingQuery("GET /org/performance/goals"),
      pendingQuery("GET /org/performance/goals/:id/activities"),
    ]);
    setGoals(gs ?? []);
    setItems(acts ?? []);
  };
  useEffect(() => { void load(); }, [org]);

  const save = async () => {
    if (!org) return;
    const parsed = schema.safeParse({ goal_id: form.goal_id, title: form.title, planned_date: form.planned_date || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const empId = await requireEmployee();
    if (empId === false) return;
    const { error } = await pendingQuery("POST /org/performance/goals/:id/activities");
    if (error) return toast.error(error.message);
    toast.success(t("activities.createdSuccess"));
    setOpen(false);
    setForm(empty);
    void load();
  };

  const setStatus = async (a: any, next: typeof STATUSES[number]) => {
    setItems((prev) => prev.map((it) => (it.id === a.id ? { ...it, status: next, completed_at: next === "done" ? new Date().toISOString() : null } : it)));
    const { error } = await pendingQuery("PATCH /org/performance/goals/:id/activities");
    if (error) { toast.error(error.message); void load(); }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: t("activities.deleteConfirm"), description: t("activities.deleteConfirmDesc"), actionLabel: t("common.delete"), actionVariant: "destructive" }))) return;
    const { error } = await pendingQuery("DELETE /org/performance/goals/:id/activities");
    if (error) return toast.error(error.message);
    void load();
  };

  const canSubmit = !!form.goal_id && form.title.trim().length >= 3;

  return (
    <div>
      {confirmDialog}
      <PageHeader title={t("activities.title")} description={t("activities.description")}
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild><Button disabled={goals.length === 0}><Plus className="mr-2 h-4 w-4"/>{t("activities.newActivity")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("activities.newActivity")}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  <div>
                    <Label>{t("activities.linkedGoal")} <span className="text-destructive">*</span></Label>
                    <Select value={form.goal_id} onValueChange={(v) => setForm({ ...form, goal_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t("activities.select")} /></SelectTrigger>
                      <SelectContent>
                        {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("activities.activityTitle")} <span className="text-destructive">*</span></Label>
                    <Input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("activities.plannedDate")}</Label>
                    <Input type="date" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} />
                  </div>
                  <Button className="w-full" onClick={save} disabled={!canSubmit}>{t("activities.create")}</Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      {goals.length === 0 && (
        <p className="mb-4 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("activities.createNeedsGoal")}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-lg border bg-muted/30 p-3">
            <h3 className="mb-2 text-sm font-semibold">{STATUS_LABELS[s]} <span className="text-muted-foreground">({items.filter((i) => i.status === s).length})</span></h3>
            <div className="grid gap-2">
              {items.filter((i) => i.status === s).map((a) => {
                const goal = goals.find((g) => g.id === a.goal_id);
                return (
                  <Card key={a.id}><CardContent className="p-3">
                    <p className="text-sm font-medium">{a.title}</p>
                    {goal && <Badge variant="outline" className="mt-1 text-[10px]">{goal.title}</Badge>}
                    <div className="mt-2 flex items-center gap-1">
                      <Select value={a.status} onValueChange={(v: any) => void setStatus(a, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((st) => <SelectItem key={st} value={st}>{STATUS_LABELS[st]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent></Card>
                );
              })}
              {items.filter((i) => i.status === s).length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">{t("activities.empty")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
