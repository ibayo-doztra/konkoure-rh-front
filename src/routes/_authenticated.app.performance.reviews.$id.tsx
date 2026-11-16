import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, PenLine, Save, Send, Undo2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/performance/reviews/$id")({
  component: ReviewDetailPage,
});

const SCORE_VALUES = ["1", "2", "3", "4", "5"] as const;

const REVIEW_STATUS_CLS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  sent_back: "bg-destructive/10 text-destructive",
  submitted: "bg-success/10 text-success",
  validated: "bg-success/15 text-success",
  signed: "bg-success/15 text-success",
};

function ScoreLegend() {
  const { t } = useTranslation();
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {SCORE_VALUES.map((v) => (
        <li key={v}>
          <span className="font-medium text-foreground">{t(`reviews.scoreOptions.${v}` as any)}</span>{"\u00A0"}{t(`reviews.scoreDescriptions.${v}` as any)}
        </li>
      ))}
    </ul>
  );
}

function ReviewDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { org } = useOrg();
  const { user } = useAuth();
  const { myEmployee, isSuperAdmin, requireEmployee } = useMyEmployee();
  const { confirm, confirmDialog } = useConfirm();

  const [review, setReview] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [okrs, setOkrs] = useState<any[]>([]);

  const [selfComments, setSelfComments] = useState<Record<string, string>>({});
  const [mgrComments, setMgrComments] = useState<Record<string, string>>({});
  const [selfGlobal, setSelfGlobal] = useState("");
  const [selfScore, setSelfScore] = useState<number | null>(null);
  const [mgrGlobal, setMgrGlobal] = useState("");
  const [mgrScore, setMgrScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: r, error: rErr } = await pendingQuery("GET /org/performance/reviews");
    if (rErr) {
      toast.error(rErr.message);
      setLoading(false);
      return;
    }
    if (!r) { setLoading(false); return; }
    setReview(r);

    // Charge l'employé séparément (aucune FK déclarée pour le join PostgREST)
    let employeeRow: any = null;
    if ((r as any).employee_id) {
      const { data: emp } = await pendingQuery("GET /org/employees");
      employeeRow = emp ?? null;
    }
    setEmployee(employeeRow);

    let planRow: any = null;
    if ((r as any).plan_id) {
      const { data: p } = await pendingQuery("GET /org/performance/plans");
      planRow = p ?? null;
    }
    setPlan(planRow);

    setSelfGlobal(r.self_global_comment ?? "");
    setSelfScore(r.self_score ?? null);
    setMgrGlobal((r as any).manager_global_comment ?? "");
    setMgrScore((r as any).manager_score ?? null);

    const goalsMap = new Map<string, any>();
    const { data: gByReview } = await pendingQuery("GET /org/performance/goals");
    (gByReview ?? []).forEach((g: any) => goalsMap.set(g.id, g));

    if ((r as any).plan_id && (r as any).employee_id) {
      const { data: gByPlan } = await pendingQuery("GET /org/performance/goals");
      (gByPlan ?? []).forEach((g: any) => { if (!goalsMap.has(g.id)) goalsMap.set(g.id, g); });
    }
    setGoals(Array.from(goalsMap.values()));

    // OKR du collaborateur sur la période du plan (lecture seule)
    if ((r as any).employee_id) {
      const { data: okrRows } = await pendingQuery("GET /org/performance/okrs");
      let list = okrRows ?? [];
      if (planRow?.period_start && planRow?.period_end) {
        const quarters = new Set<string>();
        const start = new Date(planRow.period_start);
        const end = new Date(planRow.period_end);
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cursor <= end) {
          quarters.add(`Q${Math.floor(cursor.getMonth() / 3) + 1}-${cursor.getFullYear()}`);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        const filtered = list.filter((o: any) => quarters.has(o.quarter));
        if (filtered.length) list = filtered;
      }
      setOkrs(list);
    } else {
      setOkrs([]);
    }


    const { data: c } = await pendingQuery("GET /org/performance/reviews/:id");
    const sm: Record<string, string> = {};
    const mm: Record<string, string> = {};
    (c ?? []).forEach((x: any) => {
      sm[x.goal_id] = x.self_comment ?? "";
      mm[x.goal_id] = x.manager_comment ?? "";
    });
    setSelfComments(sm);
    setMgrComments(mm);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [id]);

  const isOwner = employee?.user_id === user?.id;
  const isManager = !!review?.manager_id && review.manager_id === myEmployee?.id;
  const status: string = review?.status ?? "not_started";
  const isSubmitted = status === "submitted";
  const isSentBack = status === "sent_back";
  const isValidated = status === "validated";
  const isSigned = status === "signed";
  const canEditSelf = isOwner && (status === "not_started" || status === "in_progress" || isSentBack);
  const canEditManager =
    !isOwner && (isManager || isSuperAdmin) && !!review?.submitted_at && !isValidated && !isSigned;
  const hasManagerFeedback =
    !!review?.manager_score ||
    !!(review?.manager_global_comment ?? "").trim() ||
    Object.values(mgrComments).some((v) => (v ?? "").trim().length > 0);
  const canSign = isOwner && isValidated;

  const updateGoalStatus = async (goalId: string, status: string) => {
    if (!canEditSelf || isSubmitted) return;
    const { error } = await pendingQuery("PATCH /org/performance/goals");
    if (error) return toast.error(error.message);
    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, status } : x)));
  };

  const persistComments = async (which: "self" | "manager") => {
    if (!org || !review) return true;
    const map = which === "self" ? selfComments : mgrComments;
    const rows = goals.map((g) => ({
      organization_id: org.id,
      review_id: review.id,
      goal_id: g.id,
      ...(which === "self" ? { self_comment: map[g.id] ?? "" } : { manager_comment: map[g.id] ?? "" }),
    }));
    if (!rows.length) return true;
    const { error } = await pendingQuery("PUT /org/performance/reviews/:id");
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const saveSelfDraft = async (showToast = true) => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    setBusy(true);
    if (!(await persistComments("self"))) { setBusy(false); return; }
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (showToast) toast.success(t("reviews.draftSaved"));
    await load();
  };

  const submitSelf = async () => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    const missing = goals.filter((g) => !(selfComments[g.id] ?? "").trim());
    if (missing.length) return toast.error(t("reviews.errors.commentAllGoals", { count: missing.length }));
    if (!selfGlobal.trim()) return toast.error(t("reviews.errors.globalCommentRequired"));
    if (!selfScore) return toast.error(t("reviews.errors.scoreRequired"));
    setBusy(true);
    await saveSelfDraft(false);
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (review.manager_id) {
      const mgr = await pendingQuery("GET /org/employees");
      if (mgr.data?.user_id && org) {
        await pendingQuery("POST /me/notifications");
      }
    }
    toast.success(t("reviews.submittedToManager"));
    navigate({ to: "/app/performance/reviews" });
  };

  const saveManagerDraft = async (showToast = true) => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    setBusy(true);
    if (!(await persistComments("manager"))) { setBusy(false); return; }
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (showToast) toast.success(t("reviews.managerReviewSaved"));
    await load();
  };

  const submitManager = async () => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    const missing = goals.filter((g) => !(mgrComments[g.id] ?? "").trim());
    if (missing.length) return toast.error(t("reviews.errors.commentAllGoals", { count: missing.length }));
    if (!mgrGlobal.trim()) return toast.error(t("reviews.errors.globalCommentRequired"));
    if (!mgrScore) return toast.error(t("reviews.errors.managerScoreRequired"));
    setBusy(true);
    await saveManagerDraft(false);
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (employee?.user_id && org) {
      await pendingQuery("POST /me/notifications");
    }
    toast.success(t("reviews.managerReviewSubmitted"));
    await load();
  };

  const sendBack = async () => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    const ok = await confirm({
      title: t("reviews.sendBackConfirmTitle"),
      subtitle: employee ? `${employee.first_name} ${employee.last_name}` : undefined,
      description: t("reviews.sendBackConfirmDesc"),
      actionLabel: t("reviews.sendBack"),
    });
    if (!ok) return;
    setBusy(true);
    if (!(await persistComments("manager"))) { setBusy(false); return; }
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (employee?.user_id && org) {
      await pendingQuery("POST /me/notifications");
    }
    toast.success(t("reviews.sendBackSuccess"));
    await load();
  };

  const signReview = async () => {
    if (!review) return;
    if ((await requireEmployee()) === false) return;
    const ok = await confirm({
      title: t("reviews.signConfirmTitle"),
      subtitle: plan?.name,
      description: t("reviews.signConfirmDesc"),
      actionLabel: t("reviews.sign"),
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await pendingQuery("PATCH /org/performance/reviews");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (review.manager_id && org) {
      const mgr = await pendingQuery("GET /org/employees");
      if (mgr.data?.user_id) {
        await pendingQuery("POST /me/notifications");
      }
    }
    toast.success(t("reviews.signSuccess"));
    await load();
  };



  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!review) return <p className="py-12 text-center text-muted-foreground">{t("reviews.notFound")}</p>;

  const managerSubmitted = !!review?.manager_submitted_at;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reviews.evaluationOf", { name: `${employee?.first_name} ${employee?.last_name}` })}
        description={plan ? `${plan.name} — ${plan.period_start} → ${plan.period_end}` : t("reviews.evaluationDefault")}
        actions={<Badge className={REVIEW_STATUS_CLS[review.status] ?? REVIEW_STATUS_CLS.not_started}>{t(`reviews.statuses.${review.status}` as any)}</Badge>}
      />

      {isOwner && isSubmitted && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("reviews.submittedReadOnly", { date: review.submitted_at ? t("reviews.submittedOn", { date: formatDate(review.submitted_at) }) : "" })}
          </CardContent>
        </Card>
      )}

      {isOwner && isSentBack && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-destructive">{t("reviews.sentBackBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("reviews.sentBackBannerDesc")}</p>
          </CardContent>
        </Card>
      )}

      {isOwner && isValidated && (
        <Card className="border-success/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-success">{t("reviews.validatedBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("reviews.validatedBannerDesc")}</p>
          </CardContent>
        </Card>
      )}

      {isOwner && isSigned && (
        <Card className="border-success/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-success">{t("reviews.signedBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("reviews.signedBannerDesc", { date: review.signed_at ? formatDate(review.signed_at) : "" })}
            </p>
          </CardContent>
        </Card>
      )}

      {!isOwner && !isManager && !isSuperAdmin && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          {t("reviews.readOnlyOther")}
        </CardContent></Card>
      )}

      {okrs.length > 0 && (
        <section className="mb-4 space-y-3">
          <h2 className="font-semibold">{t("reviews.okrsTitle", { count: okrs.length })}</h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              {okrs.map((o) => (
                <div key={o.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{o.objective}</p>
                    <span className="text-sm tabular-nums text-muted-foreground">{o.progress}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.quarter} · {t(`okrs.reviewStatuses.${o.review_status ?? "draft"}`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}


      <section className="space-y-3">
        <h2 className="font-semibold">{t("reviews.goalsCount", { count: goals.length })}</h2>
        {goals.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("reviews.noGoalsLinked")}
          </CardContent></Card>
        )}
        {goals.map((g) => (
          <Card key={g.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.title}</p>
                  {g.measurement && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("reviews.indicatorLabel")}</span>{g.measurement}
                    </p>
                  )}
                </div>
                {canEditSelf ? (
                  <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["not_started", "in_progress", "late", "achieved"] as const).map((k) => (
                        <SelectItem key={k} value={k}>{t(`reviews.goalStatuses.${k}` as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{t(`reviews.goalStatuses.${g.status}` as any, { defaultValue: g.status })}</Badge>
                )}
              </div>
              <div>
                <Label>{t("reviews.employeeComment")}</Label>
                {canEditSelf ? (
                  <Textarea
                    rows={3}
                    value={selfComments[g.id] ?? ""}
                    onChange={(e) => setSelfComments((m) => ({ ...m, [g.id]: e.target.value }))}
                    placeholder={t("reviews.employeeCommentPlaceholder")}
                  />
                ) : (
                  <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {selfComments[g.id] ?? ""}
                  </p>
                )}
              </div>
              {(isSubmitted || managerSubmitted || canEditManager || hasManagerFeedback) && (
                <div>
                  <Label>{t("reviews.managerComment")}</Label>
                  {canEditManager && !managerSubmitted ? (
                    <Textarea
                      rows={3}
                      value={mgrComments[g.id] ?? ""}
                      onChange={(e) => setMgrComments((m) => ({ ...m, [g.id]: e.target.value }))}
                      placeholder={t("reviews.managerCommentPlaceholder")}
                    />
                  ) : (
                    <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {mgrComments[g.id] ?? ""}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h2 className="font-semibold">{t("reviews.selfAssessment")}</h2>
          {canEditSelf ? (
            <Textarea
              rows={4}
              value={selfGlobal}
              onChange={(e) => setSelfGlobal(e.target.value)}
              placeholder={t("reviews.selfAssessmentPlaceholder")}
            />
          ) : (
            <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
              {selfGlobal}
            </p>
          )}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Label>{t("reviews.myScore")}</Label>
              <Select value={selfScore ? String(selfScore) : ""} onValueChange={(v) => setSelfScore(Number(v))} disabled={!canEditSelf}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t("reviews.chooseScore")} /></SelectTrigger>
                <SelectContent>
                  {SCORE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      <span>{t(`reviews.scoreOptions.${v}` as any)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScoreLegend />
          </div>
        </CardContent>
      </Card>

      {(isSubmitted || canEditManager || hasManagerFeedback) && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <h2 className="font-semibold">{t("reviews.managerAssessment")}</h2>
            {!isSubmitted && !hasManagerFeedback && !canEditManager && (
              <p className="text-sm text-muted-foreground">{t("reviews.managerAssessmentWaiting")}</p>
            )}
            {canEditManager && !managerSubmitted ? (
              <Textarea
                rows={4}
                value={mgrGlobal}
                onChange={(e) => setMgrGlobal(e.target.value)}
                placeholder={t("reviews.managerScorePlaceholder")}
              />
            ) : (
              mgrGlobal && (
                <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {mgrGlobal}
                </p>
              )
            )}
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label>{t("reviews.assignedScore")}</Label>
                <Select value={mgrScore ? String(mgrScore) : ""} onValueChange={(v) => setMgrScore(Number(v))} disabled={!canEditManager || managerSubmitted}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t("reviews.chooseScore")} /></SelectTrigger>
                  <SelectContent>
                    {SCORE_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        <span>{t(`reviews.scoreOptions.${v}` as any)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScoreLegend />
            </div>
          </CardContent>
        </Card>
      )}

      {review.status === "signed" && review.signed_at && (
        <Card>
          <CardContent className="p-4 text-sm sm:p-6">
            <p className="text-muted-foreground">{t("reviews.signatureLabel")}</p>
            <p className="mt-1 font-medium text-foreground">
              {`${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim()}
            </p>
            <p className="text-muted-foreground">{t("reviews.signatureOn", { date: formatDate(review.signed_at) })}</p>
          </CardContent>
        </Card>
      )}

      {canEditSelf && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button variant="outline" onClick={() => saveSelfDraft()} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />{t("reviews.save")}
          </Button>
          <Button onClick={submitSelf} disabled={busy}>
            <Send className="mr-2 h-4 w-4" />{t("reviews.submitToManager")}
          </Button>
        </div>
      )}

      {canSign && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button onClick={signReview} disabled={busy}>
            <PenLine className="mr-2 h-4 w-4" />{t("reviews.sign")}
          </Button>
        </div>
      )}

      {canEditManager && !managerSubmitted && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button variant="outline" onClick={() => saveManagerDraft()} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />{t("reviews.save")}
          </Button>
          <Button variant="outlineDanger" onClick={sendBack} disabled={busy}>
            <Undo2 className="mr-2 h-4 w-4" />{t("reviews.sendBack")}
          </Button>
          <Button onClick={submitManager} disabled={busy}>
            <Send className="mr-2 h-4 w-4" />{t("reviews.submitManagerReview")}
          </Button>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
