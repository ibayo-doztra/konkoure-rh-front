import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, PenLine, Save, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api/client";
import {
  cyclesQuery,
  okrsQuery,
  performanceKey,
  plansQuery,
  REVIEW_STATUS_CLASS,
  reviewQuery,
  saveManagerReview,
  saveSelfReview,
  SELF_EDITABLE,
  sendBackReview,
  signReview,
  submitSelfReview,
  validateReview,
  type Review,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogActions,
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
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/app/performance/reviews/$id")({
  component: ReviewDetailPage,
});

const SCORE_VALUES = ["1", "2", "3", "4", "5"] as const;

function ScoreLegend() {
  const { t } = useTranslation();
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {SCORE_VALUES.map((v) => (
        <li key={v}>
          <span className="font-medium text-foreground">{t(`reviews.scoreOptions.${v}`)}</span>
          {" "}
          {t(`reviews.scoreDescriptions.${v}`)}
        </li>
      ))}
    </ul>
  );
}

function ReviewDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { org } = useOrg();
  const review = useQuery({ ...reviewQuery(org?.id ?? "", id), enabled: !!org });

  if (review.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!review.data) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        {review.isError && review.error ? apiErrorMessage(review.error) : t("reviews.notFound")}
      </p>
    );
  }
  // Remounted on every server change, so the drafts restart from the saved values.
  return <ReviewForm key={review.data.updatedAt} review={review.data} />;
}

/** The text shown read-only, never in a disabled field (07 §5.7). */
function ReadOnlyText({ value }: { value: string | null | undefined }) {
  return (
    <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
      {value ?? ""}
    </p>
  );
}

function ScoreSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Label htmlFor={id}>{label}</Label>
        <Select
          value={value ? String(value) : ""}
          onValueChange={(v) => onChange(Number(v))}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full sm:w-64">
            <SelectValue placeholder={t("reviews.chooseScore")} />
          </SelectTrigger>
          <SelectContent>
            {SCORE_VALUES.map((v) => (
              <SelectItem key={v} value={v}>
                {t(`reviews.scoreOptions.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScoreLegend />
    </div>
  );
}

function ReviewForm({ review }: { review: Review }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const access = usePerformanceAccess();
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });
  const cycles = useQuery({ ...cyclesQuery(organizationId), enabled: !!org });
  const okrs = useQuery({ ...okrsQuery(organizationId), enabled: !!org });

  const [selfComments, setSelfComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(review.goals.map((g) => [g.id, g.selfComment ?? ""])),
  );
  const [mgrComments, setMgrComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(review.goals.map((g) => [g.id, g.managerComment ?? ""])),
  );
  const [selfGlobal, setSelfGlobal] = useState(review.selfGlobalComment ?? "");
  const [selfScore, setSelfScore] = useState<number | null>(review.selfScore);
  const [mgrGlobal, setMgrGlobal] = useState(review.managerGlobalComment ?? "");
  const [mgrScore, setMgrScore] = useState<number | null>(review.managerScore);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");

  const status = review.status;
  const isEvaluated = access.isSelf(review.employeeId);
  // HR or the manager, never on one's own evaluation (06 §9).
  const isEvaluator =
    !isEvaluated &&
    (access.isAdmin ||
      (!!access.myEmployeeId && review.managerId === access.myEmployeeId) ||
      access.inMyTeam(review.employeeId));
  const canEditSelf = isEvaluated && SELF_EDITABLE.includes(status);
  const canEditManager = isEvaluator && status === "submitted";
  const canSign = isEvaluated && status === "validated";
  const managerVisible =
    status === "submitted" ||
    status === "sent_back" ||
    status === "validated" ||
    status === "signed";

  const plan = review.planId ? plans.data?.find((p) => p.id === review.planId) : undefined;
  const cycle = review.cycleId ? cycles.data?.find((c) => c.id === review.cycleId) : undefined;
  const period = plan ?? cycle;
  const employeeName = access.nameOf(review.employeeId) ?? "—";

  // The employee's OKR over the period, read-only.
  const relatedOkrs = useMemo(() => {
    const own = (okrs.data ?? []).filter((o) => o.employeeId === review.employeeId);
    if (!period) return own;
    const quarters = new Set<string>();
    const end = new Date(period.periodEnd);
    for (
      const cursor = new Date(period.periodStart);
      cursor <= end;
      cursor.setMonth(cursor.getMonth() + 1)
    ) {
      quarters.add(`${cursor.getFullYear()}-Q${Math.floor(cursor.getMonth() / 3) + 1}`);
    }
    return own.filter((o) => quarters.has(o.quarter));
  }, [okrs.data, review.employeeId, period]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const selfPayload = () => ({
    selfScore,
    selfGlobalComment: selfGlobal.trim() || null,
    goals: review.goals.map((g) => ({
      goalId: g.id,
      comment: (selfComments[g.id] ?? "").trim() || null,
    })),
  });
  const managerPayload = () => ({
    managerScore: mgrScore,
    managerGlobalComment: mgrGlobal.trim() || null,
    goals: review.goals.map((g) => ({
      goalId: g.id,
      comment: (mgrComments[g.id] ?? "").trim() || null,
    })),
  });

  const saveSelf = useMutation({
    mutationFn: async (submit: boolean) => {
      await saveSelfReview(review.id, selfPayload());
      if (submit) await submitSelfReview(review.id);
      return submit;
    },
    onSuccess: async (submitted) => {
      await refresh();
      if (submitted) {
        toast.success(t("reviews.submittedToManager"));
        void navigate({ to: "/app/performance/reviews" });
      } else {
        toast.success(t("reviews.draftSaved"));
      }
    },
    onError,
  });

  const saveManager = useMutation({
    mutationFn: async (action: "save" | "validate") => {
      await saveManagerReview(review.id, managerPayload());
      if (action === "validate") await validateReview(review.id);
      return action;
    },
    onSuccess: (action) => {
      toast.success(
        action === "validate"
          ? t("reviews.managerReviewSubmitted")
          : t("reviews.managerReviewSaved"),
      );
      return refresh();
    },
    onError,
  });

  const sendBack = useMutation({
    mutationFn: async (comment: string) => {
      await saveManagerReview(review.id, managerPayload());
      return sendBackReview(review.id, comment);
    },
    onSuccess: () => {
      toast.success(t("reviews.sendBackSuccess"));
      setSendBackOpen(false);
      return refresh();
    },
    onError,
  });

  const sign = useMutation({
    mutationFn: () => signReview(review.id),
    onSuccess: () => {
      toast.success(t("reviews.signSuccess"));
      return refresh();
    },
    onError,
  });

  const busy = saveSelf.isPending || saveManager.isPending || sendBack.isPending || sign.isPending;

  const submitSelf = () => {
    const missing = review.goals.filter((g) => !(selfComments[g.id] ?? "").trim());
    if (missing.length) {
      return toast.error(t("reviews.errors.commentAllGoals", { count: missing.length }));
    }
    if (!selfGlobal.trim()) return toast.error(t("reviews.errors.globalCommentRequired"));
    if (!selfScore) return toast.error(t("reviews.errors.scoreRequired"));
    saveSelf.mutate(true);
  };

  const validate = () => {
    if (!mgrGlobal.trim()) return toast.error(t("reviews.errors.globalCommentRequired"));
    if (!mgrScore) return toast.error(t("reviews.errors.managerScoreRequired"));
    saveManager.mutate("validate");
  };

  const askSign = async () => {
    const ok = await confirm({
      title: t("reviews.signConfirmTitle"),
      subtitle: plan?.name ?? cycle?.name,
      description: t("reviews.signConfirmDesc"),
      actionLabel: t("reviews.sign"),
    });
    if (ok) sign.mutate();
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title={t("reviews.evaluationOf", { name: employeeName })}
        description={
          period
            ? `${period.name} — ${formatDate(period.periodStart)} → ${formatDate(period.periodEnd)}`
            : t("reviews.evaluationDefault")
        }
        actions={
          <Badge className={REVIEW_STATUS_CLASS[status]}>{t(`reviews.statuses.${status}`)}</Badge>
        }
      />

      {isEvaluated && status === "submitted" && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("reviews.submittedReadOnly", {
              date: review.submittedAt
                ? t("reviews.submittedOn", { date: formatDate(review.submittedAt) })
                : "",
            })}
          </CardContent>
        </Card>
      )}

      {status === "sent_back" && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-destructive">{t("reviews.sentBackBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("reviews.sentBackBannerDesc")}</p>
            {review.sentBackComment && (
              <p className="mt-2 whitespace-pre-wrap">{review.sentBackComment}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isEvaluated && status === "validated" && (
        <Card className="border-success/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-success">{t("reviews.validatedBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("reviews.validatedBannerDesc")}</p>
          </CardContent>
        </Card>
      )}

      {isEvaluated && status === "signed" && (
        <Card className="border-success/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-success">{t("reviews.signedBannerTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("reviews.signedBannerDesc", {
                date: review.signedAt ? formatDate(review.signedAt) : "",
              })}
            </p>
          </CardContent>
        </Card>
      )}

      {!isEvaluated && !isEvaluator && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("reviews.readOnlyOther")}
          </CardContent>
        </Card>
      )}

      {relatedOkrs.length > 0 && (
        <section className="mb-4 space-y-3">
          <h2 className="font-semibold">{t("reviews.okrsTitle", { count: relatedOkrs.length })}</h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              {relatedOkrs.map((o) => (
                <div key={o.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{o.objective}</p>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {o.progress}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.quarter} · {t(`okrs.reviewStatuses.${o.reviewStatus}`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{t("reviews.goalsCount", { count: review.goals.length })}</h2>
        {review.goals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("reviews.noGoalsLinked")}
            </CardContent>
          </Card>
        )}
        {review.goals.map((g) => (
          <Card key={g.id} data-testid="review-goal">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.title}</p>
                  {g.measurement && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("reviews.indicatorLabel")}</span>
                      {g.measurement}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{t(`goals.statuses.${g.status}`)}</Badge>
              </div>
              <div>
                <Label htmlFor={`self-${g.id}`}>{t("reviews.employeeComment")}</Label>
                {canEditSelf ? (
                  <Textarea
                    id={`self-${g.id}`}
                    rows={3}
                    maxLength={5000}
                    value={selfComments[g.id] ?? ""}
                    onChange={(e) => setSelfComments((m) => ({ ...m, [g.id]: e.target.value }))}
                    placeholder={t("reviews.employeeCommentPlaceholder")}
                  />
                ) : (
                  <ReadOnlyText value={selfComments[g.id]} />
                )}
              </div>
              {managerVisible && (
                <div>
                  <Label htmlFor={`mgr-${g.id}`}>{t("reviews.managerComment")}</Label>
                  {canEditManager ? (
                    <Textarea
                      id={`mgr-${g.id}`}
                      rows={3}
                      maxLength={5000}
                      value={mgrComments[g.id] ?? ""}
                      onChange={(e) => setMgrComments((m) => ({ ...m, [g.id]: e.target.value }))}
                      placeholder={t("reviews.managerCommentPlaceholder")}
                    />
                  ) : (
                    <ReadOnlyText value={mgrComments[g.id]} />
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
              maxLength={10000}
              aria-label={t("reviews.selfAssessment")}
              value={selfGlobal}
              onChange={(e) => setSelfGlobal(e.target.value)}
              placeholder={t("reviews.selfAssessmentPlaceholder")}
            />
          ) : (
            <ReadOnlyText value={selfGlobal} />
          )}
          <ScoreSelect
            id="self-score"
            label={t("reviews.myScore")}
            value={selfScore}
            onChange={setSelfScore}
            disabled={!canEditSelf}
          />
        </CardContent>
      </Card>

      {managerVisible && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <h2 className="font-semibold">{t("reviews.managerAssessment")}</h2>
            {canEditManager ? (
              <Textarea
                rows={4}
                maxLength={10000}
                aria-label={t("reviews.managerAssessment")}
                value={mgrGlobal}
                onChange={(e) => setMgrGlobal(e.target.value)}
                placeholder={t("reviews.managerScorePlaceholder")}
              />
            ) : mgrGlobal ? (
              <ReadOnlyText value={mgrGlobal} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("reviews.managerAssessmentWaiting")}
              </p>
            )}
            <ScoreSelect
              id="manager-score"
              label={t("reviews.assignedScore")}
              value={mgrScore}
              onChange={setMgrScore}
              disabled={!canEditManager}
            />
          </CardContent>
        </Card>
      )}

      {status === "signed" && review.signedAt && (
        <Card>
          <CardContent className="p-4 text-sm sm:p-6">
            <p className="text-muted-foreground">{t("reviews.signatureLabel")}</p>
            <p className="mt-1 font-medium text-foreground">{employeeName}</p>
            <p className="text-muted-foreground">
              {t("reviews.signatureOn", { date: formatDate(review.signedAt) })}
            </p>
          </CardContent>
        </Card>
      )}

      {canEditSelf && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button variant="outline" onClick={() => saveSelf.mutate(false)} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {t("reviews.save")}
          </Button>
          <Button onClick={submitSelf} disabled={busy}>
            <Send className="mr-2 h-4 w-4" />
            {t("reviews.submitToManager")}
          </Button>
        </div>
      )}

      {canSign && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button onClick={() => void askSign()} disabled={busy}>
            <PenLine className="mr-2 h-4 w-4" />
            {t("reviews.sign")}
          </Button>
        </div>
      )}

      {canEditManager && (
        <div className="sticky bottom-4 ml-auto flex w-full flex-wrap justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:w-fit">
          <Button variant="outline" onClick={() => saveManager.mutate("save")} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {t("reviews.save")}
          </Button>
          <Button variant="outlineDanger" onClick={() => setSendBackOpen(true)} disabled={busy}>
            <Undo2 className="mr-2 h-4 w-4" />
            {t("reviews.sendBack")}
          </Button>
          <Button onClick={validate} disabled={busy}>
            <Send className="mr-2 h-4 w-4" />
            {t("reviews.submitManagerReview")}
          </Button>
        </div>
      )}

      <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reviews.sendBackConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm font-medium">{employeeName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("reviews.sendBackConfirmDesc")}</p>
            <div className="mt-4">
              <Label htmlFor="review-sendback">
                {t("reviews.sendBackComment")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="review-sendback"
                rows={4}
                maxLength={5000}
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
              />
            </div>
            <DialogActions>
              <Button variant="outline" onClick={() => setSendBackOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="outlineDanger"
                disabled={busy}
                onClick={() => {
                  const comment = sendBackComment.trim();
                  if (!comment) return toast.error(t("reviews.errors.sendBackCommentRequired"));
                  sendBack.mutate(comment);
                }}
              >
                {t("reviews.sendBack")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
