import { createFileRoute } from "@tanstack/react-router";
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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Trash2, MessageSquare, Send, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/useConfirm";

function useOkrSchema(t: (k: string) => string) {
  return z.object({
    objective: z.string().trim().min(3, t("okrs.errors.objectiveMin")).max(200, t("okrs.errors.objectiveMax")),
    quarter: z.string().trim().regex(/^Q[1-4]-\d{4}$/, t("okrs.errors.quarterFormat")).or(z.literal("")),
    key_results: z.array(z.string().trim().min(1).max(300, t("okrs.errors.keyResultMax"))).min(1, t("okrs.errors.keyResultsMin")),
  });
}

export const Route = createFileRoute("/_authenticated/app/performance/okrs")({
  component: OkrsPage,
});

type EmployeeLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
  user_id: string | null;
};

function OkrsPage() {
  const { t, i18n } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const okrSchema = useOkrSchema(t);
  const { org } = useOrg();
  const { requireEmployee, myEmployee } = useMyEmployee();
  const { isAdmin } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [checkins, setCheckins] = useState<Record<string, any[]>>({});
  const [checkinDraft, setCheckinDraft] = useState<Record<string, string>>({});
  const [openCheckins, setOpenCheckins] = useState<Record<string, boolean>>({});
  const [sendBackFor, setSendBackFor] = useState<any | null>(null);
  const [sendBackComment, setSendBackComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ objective: "", quarter: "", key_results: "" });
  const [suggesting, setSuggesting] = useState(false);

  const empById = useMemo(() => {
    const m: Record<string, EmployeeLite> = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const load = async () => {
    if (!org) return;
    const [{ data: okrs }, { data: emps }] = await Promise.all([
      pendingQuery("GET /org/performance/okrs"),
      pendingQuery("GET /org/employees"),
    ]);
    setItems(okrs ?? []);
    setEmployees((emps ?? []) as EmployeeLite[]);
    const ids = (okrs ?? []).map((o: any) => o.id);
    if (ids.length) {
      const { data: cks } = await pendingQuery("GET /org/performance/okrs/:id/checkins");
      const grouped: Record<string, any[]> = {};
      (cks ?? []).forEach((c: any) => {
        (grouped[c.okr_id] ??= []).push(c);
      });
      setCheckins(grouped);
    } else {
      setCheckins({});
    }
  };
  useEffect(() => { void load(); }, [org]);

  const isOwner = (o: any) => !!myEmployee && o.employee_id === myEmployee.id;
  const isManagerOf = (o: any) =>
    isAdmin || (!!myEmployee && !!o.employee_id && empById[o.employee_id]?.manager_id === myEmployee.id);

  const ownerName = (o: any) => {
    const e = o.employee_id ? empById[o.employee_id] : null;
    return e ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() : "—";
  };

  const notify = async (employeeId: string | null | undefined, title: string, body: string) => {
    if (!org || !employeeId) return;
    const userId = empById[employeeId]?.user_id;
    if (!userId) return;
    await pendingQuery("POST /me/notifications");
  };

  const suggest = async () => {
    if (!form.objective.trim()) return;
    setSuggesting(true);
    try {
      const { data, error } = await pendingQuery("POST /org/performance/okrs/suggest");
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) return toast.error(t("okrs.aiRateLimit"));
        if (status === 402) return toast.error(t("okrs.aiNoCredits"));
        return toast.error(t("okrs.aiError"));
      }
      const suggestions: string[] = Array.isArray(data?.key_results) ? data.key_results.filter(Boolean) : [];
      if (suggestions.length === 0) return toast.error(t("okrs.aiEmpty"));
      const existing = form.key_results.split("\n").map((s) => s.trim()).filter(Boolean);
      const merged = [...existing, ...suggestions.filter((s) => !existing.includes(s))];
      setForm({ ...form, key_results: merged.join("\n") });
      toast.success(t("okrs.aiSuccess", { count: suggestions.length }));
    } finally {
      setSuggesting(false);
    }
  };

  const krList = form.key_results.split("\n").map((s) => s.trim()).filter(Boolean);
  const canSubmit = form.objective.trim().length >= 3 && krList.length >= 1;

  const save = async () => {
    if (!org) return;
    const parsed = okrSchema.safeParse({
      objective: form.objective,
      quarter: form.quarter,
      key_results: krList,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const krs = parsed.data.key_results.map((kr) => ({ text: kr, done: false }));
    const empId = await requireEmployee();
    if (empId === false) return;
    const { error } = await pendingQuery("POST /org/performance/okrs");
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({ objective: "", quarter: "", key_results: "" });
    void load();
  };

  const toggleKr = async (okr: any, idx: number) => {
    const krs = (okr.key_results ?? []).map((k: any, i: number) =>
      i === idx ? { ...k, done: !k.done } : k,
    );
    const done = krs.filter((k: any) => k.done).length;
    const progress = krs.length ? Math.round((done / krs.length) * 100) : 0;
    const status = progress === 100 ? "completed" : "active";
    // optimistic update
    setItems((prev) => prev.map((o) => (o.id === okr.id ? { ...o, key_results: krs, progress, status } : o)));
    const { error } = await pendingQuery("PATCH /org/performance/okrs");
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const submitForValidation = async (o: any) => {
    setBusy(true);
    const { error } = await pendingQuery("PATCH /org/performance/okrs");
    setBusy(false);
    if (error) return toast.error(error.message);
    const managerId = o.employee_id ? empById[o.employee_id]?.manager_id : null;
    await notify(managerId, t("okrs.notifSubmittedTitle"), t("okrs.notifSubmittedBody", { name: ownerName(o), objective: o.objective }));
    toast.success(t("okrs.submittedSuccess"));
    void load();
  };

  const validateOkr = async (o: any) => {
    if (!(await confirm({
      title: t("okrs.validateConfirm"),
      description: t("okrs.validateConfirmDesc"),
      actionLabel: t("okrs.validate"),
    }))) return;
    setBusy(true);
    const { error } = await pendingQuery("PATCH /org/performance/okrs");
    setBusy(false);
    if (error) return toast.error(error.message);
    await notify(o.employee_id, t("okrs.notifValidatedTitle"), t("okrs.notifValidatedBody", { objective: o.objective }));
    toast.success(t("okrs.validatedSuccess"));
    void load();
  };

  const sendBackOkr = async () => {
    if (!sendBackFor) return;
    if (!sendBackComment.trim()) return toast.error(t("okrs.sendBackCommentRequired"));
    setBusy(true);
    const { error } = await pendingQuery("PATCH /org/performance/okrs");
    setBusy(false);
    if (error) return toast.error(error.message);
    await notify(sendBackFor.employee_id, t("okrs.notifSentBackTitle"), t("okrs.notifSentBackBody", { objective: sendBackFor.objective }));
    toast.success(t("okrs.sentBackSuccess"));
    setSendBackFor(null);
    setSendBackComment("");
    void load();
  };

  const addCheckin = async (o: any) => {
    const message = (checkinDraft[o.id] ?? "").trim();
    if (!message) return;
    if (!org) return;
    const empId = await requireEmployee();
    if (empId === false || !empId) return;
    setBusy(true);
    const { error } = await pendingQuery("POST /org/performance/okrs/:id/checkins");
    setBusy(false);
    if (error) return toast.error(error.message);
    setCheckinDraft((prev) => ({ ...prev, [o.id]: "" }));
    if (!isOwner(o)) {
      await notify(o.employee_id, t("okrs.notifCheckinTitle"), t("okrs.notifCheckinBody", { objective: o.objective }));
    }
    toast.success(t("okrs.checkinAdded"));
    void load();
  };

  const removeOkr = async (id: string) => {
    if (!(await confirm({ title: t("okrs.deleteConfirm"), description: t("okrs.deleteConfirmDesc"), actionLabel: t("common.delete"), actionVariant: "destructive" }))) return;
    const { error } = await pendingQuery("DELETE /org/performance/okrs");
    if (error) return toast.error(error.message);
    toast.success(t("okrs.deletedSuccess"));
    void load();
  };

  const reviewBadge = (o: any) => {
    switch (o.review_status) {
      case "pending":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/10">{t("okrs.reviewStatuses.pending")}</Badge>;
      case "validated":
        return <Badge variant="success">{t("okrs.reviewStatuses.validated")}</Badge>;
      case "needs_revision":
        return <Badge variant="destructive">{t("okrs.reviewStatuses.needs_revision")}</Badge>;
      default:
        return <Badge variant="outline">{t("okrs.reviewStatuses.draft")}</Badge>;
    }
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader title={t("okrs.title")} description={t("okrs.description")}
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ objective: "", quarter: "", key_results: "" }); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>{t("okrs.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("okrs.newObjective")}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="space-y-5">
                  <div>
                    <Label>{t("okrs.objective")} <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.objective}
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, objective: e.target.value })}
                    />
                  </div>
                  <div><Label>{t("okrs.quarter")}</Label><Input placeholder={t("okrs.quarterPlaceholder")} value={form.quarter} onChange={(e) => setForm({...form, quarter: e.target.value})}/></div>
                  <div>
                    <div className="flex items-center justify-between"><Label>{t("okrs.keyResults")} <span className="text-destructive">*</span></Label>
                      <Button size="sm" variant="ghost" onClick={suggest} disabled={suggesting || !form.objective.trim()}><Sparkles className="mr-1 h-3 w-3"/>{t("okrs.suggestSmart")}</Button>
                    </div>
                    <Textarea rows={4} value={form.key_results} onChange={(e) => setForm({...form, key_results: e.target.value})}/>
                    <p className="mt-1 text-xs text-muted-foreground">{t("okrs.keyResultsHint")}</p>
                  </div>
                  <Button onClick={save} className="w-full" disabled={!canSubmit}>{t("okrs.create")}</Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!sendBackFor} onOpenChange={(v) => { if (!v) { setSendBackFor(null); setSendBackComment(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("okrs.sendBackTitle")}</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">{t("okrs.sendBackDesc")}</p>
            <div className="mt-4">
              <Label>{t("okrs.managerComment")} <span className="text-destructive">*</span></Label>
              <Textarea rows={4} value={sendBackComment} onChange={(e) => setSendBackComment(e.target.value)} placeholder={t("okrs.managerCommentPlaceholder")} />
            </div>
            <DialogActions>
              <Button variant="outline" onClick={() => { setSendBackFor(null); setSendBackComment(""); }}>{t("common.cancel")}</Button>
              <Button variant="outlineDanger" onClick={() => void sendBackOkr()} disabled={busy}>{t("okrs.sendBack")}</Button>
            </DialogActions>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {items.map((o) => {
          const krs = (o.key_results ?? []) as any[];
          const doneCount = krs.filter((k) => k?.done).length;
          const allDone = krs.length > 0 && doneCount === krs.length;
          const owner = isOwner(o);
          const manager = isManagerOf(o);
          const list = checkins[o.id] ?? [];
          return (
          <Card key={o.id}><CardContent className="p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{o.objective}</p>
                  {reviewBadge(o)}
                  {allDone ? (
                    <Badge variant="success">{t("okrs.achieved")}</Badge>
                  ) : doneCount > 0 ? (
                    <Badge className="bg-warning/10 text-warning">{t("okrs.inProgress")}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{o.quarter} · {ownerName(o)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{o.progress}%</span>
                <Button size="icon" variant="ghost" onClick={() => removeOkr(o.id)} aria-label={t("okrs.deleteAria")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Progress value={o.progress} />
            <ul className="mt-3 space-y-2 text-sm">
              {(o.key_results ?? []).map((kr: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <Checkbox
                    checked={!!kr.done}
                    onCheckedChange={() => void toggleKr(o, i)}
                    aria-label={kr.text}
                    className="mt-0.5"
                  />
                  <span className={kr.done ? "line-through text-muted-foreground" : ""}>{kr.text}</span>
                </li>
              ))}
            </ul>

            {o.review_status === "needs_revision" && o.manager_comment && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive">{t("okrs.managerCommentTitle")}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{o.manager_comment}</p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {owner && (o.review_status === "draft" || o.review_status === "needs_revision") && (
                <Button size="sm" onClick={() => void submitForValidation(o)} disabled={busy}>
                  <Send className="mr-2 h-4 w-4" />{t("okrs.submitForValidation")}
                </Button>
              )}
              {manager && o.review_status === "pending" && (
                <>
                  <Button size="sm" onClick={() => void validateOkr(o)} disabled={busy}>
                    <Check className="mr-2 h-4 w-4" />{t("okrs.validate")}
                  </Button>
                  <Button size="sm" variant="outlineDanger" onClick={() => setSendBackFor(o)} disabled={busy}>
                    <Undo2 className="mr-2 h-4 w-4" />{t("okrs.sendBack")}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpenCheckins((p) => ({ ...p, [o.id]: !p[o.id] }))}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {t("okrs.checkins")} ({list.length})
              </Button>
            </div>

            {openCheckins[o.id] && (
              <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                {list.length === 0 && <p className="text-sm text-muted-foreground">{t("okrs.noCheckins")}</p>}
                {list.map((c: any) => {
                  const a = c.author_employee_id ? empById[c.author_employee_id] : null;
                  return (
                    <div key={c.id} className="rounded-md bg-card p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">
                        {a ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : "—"} · {new Date(c.created_at).toLocaleDateString()} · {c.progress_snapshot}%
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{c.message}</p>
                    </div>
                  );
                })}
                {(owner || manager) && (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      value={checkinDraft[o.id] ?? ""}
                      onChange={(e) => setCheckinDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                      placeholder={t("okrs.checkinPlaceholder")}
                    />
                    <Button size="sm" onClick={() => void addCheckin(o)} disabled={busy || !(checkinDraft[o.id] ?? "").trim()}>
                      {t("okrs.addCheckin")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent></Card>
          );
        })}
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("okrs.empty")}</p>}
      </div>
    </div>
  );
}
