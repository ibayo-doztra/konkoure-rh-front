import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/app/performance/reviews/new/$planId/$employeeId",
)({
  component: NewReviewPage,
});

const SCORE_VALUES = ["1", "2", "3", "4", "5"] as const;

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

function NewReviewPage() {
  const { t } = useTranslation();
  const { planId, employeeId } = Route.useParams();
  const navigate = useNavigate();
  const { org } = useOrg();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [selfComments, setSelfComments] = useState<Record<string, string>>({});
  const [selfGlobal, setSelfGlobal] = useState("");
  const [selfScore, setSelfScore] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!org) return;
      setLoading(true);

      // Si une évaluation existe déjà pour ce (plan, employee), rediriger.
      const { data: existing } = await pendingQuery("GET /org/performance/reviews");
      if (cancelled) return;
      if ((existing as any)?.id) {
        navigate({
          to: "/app/performance/reviews/$id",
          params: { id: (existing as any).id },
          replace: true,
        });
        return;
      }

      const [{ data: p }, { data: e }, { data: g }] = await Promise.all([
        pendingQuery("GET /org/performance/plans"),
        pendingQuery("GET /org/employees"),
        pendingQuery("GET /org/performance/goals"),
      ]);
      if (cancelled) return;
      setPlan(p ?? null);
      setEmployee(e ?? null);
      setGoals(g ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, planId, employeeId]);

  const isOwner = employee?.user_id === user?.id;

  const persist = async (submit: boolean) => {
    if (!org || !employee || !plan) return;
    if (!isOwner) {
      toast.error(t("reviews.errors.onlyOwnerSubmit"));
      return;
    }

    if (submit) {
      const missing = goals.filter((g) => !(selfComments[g.id] ?? "").trim());
      if (missing.length)
        return toast.error(t("reviews.errors.commentAllGoals", { count: missing.length }));
      if (!selfGlobal.trim()) return toast.error(t("reviews.errors.globalCommentRequired"));
      if (!selfScore) return toast.error(t("reviews.errors.scoreRequired"));
    }

    setBusy(true);
    try {
      // 1. Crée l'évaluation
      const payload: any = {
        organization_id: org.id,
        plan_id: plan.id,
        employee_id: employee.id,
        manager_id: employee.manager_id ?? null,
        self_global_comment: selfGlobal || null,
        self_score: selfScore,
        status: submit ? "submitted" : "in_progress",
      };
      if (submit) payload.submitted_at = new Date().toISOString();

      const { data: review, error: rErr } = await pendingQuery("POST /org/performance/reviews");
      if (rErr || !review) throw new Error(rErr?.message ?? t("reviews.errors.creationFailed"));

      // 2. Rattache les objectifs
      if (goals.length) {
        const { error: gErr } = await pendingQuery("PATCH /org/performance/goals");
        if (gErr) throw new Error(gErr.message);
      }

      // 3. Persiste les commentaires par objectif (non vides)
      const rows = goals
        .filter((g) => (selfComments[g.id] ?? "").trim())
        .map((g) => ({
          organization_id: org.id,
          review_id: review.id,
          goal_id: g.id,
          self_comment: selfComments[g.id],
        }));
      if (rows.length) {
        const { error: cErr } = await pendingQuery("PUT /org/performance/reviews/:id");
        if (cErr) throw new Error(cErr.message);
      }

      // 4. Notification au manager si soumission
      if (submit && employee.manager_id) {
        const { data: mgr } = await pendingQuery("GET /org/employees");
        if (mgr?.user_id) {
          await pendingQuery("POST /me/notifications");
        }
      }

      toast.success(submit ? t("reviews.submittedToManager") : t("reviews.draftSaved"));
      navigate({
        to: "/app/performance/reviews/$id",
        params: { id: review.id },
        replace: true,
      });
    } catch (e: any) {
      toast.error(e?.message ?? t("reviews.errors.genericSaveError"));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (!plan || !employee)
    return (
      <p className="py-12 text-center text-muted-foreground">
        {t("reviews.errors.planOrEmployeeNotFound")}
      </p>
    );

  const title = t("reviews.newEvaluationTitle", { name: `${employee.first_name} ${employee.last_name}`, plan: plan.name });

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`${plan.period_start} → ${plan.period_end}`}
      />

      {!isOwner && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("reviews.readOnlyOther")}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{t("reviews.goalsCount", { count: goals.length })}</h2>
        {goals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("reviews.noGoalsLinked")}
            </CardContent>
          </Card>
        )}
        {goals.map((g) => (
          <Card key={g.id}>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-semibold">{g.title}</p>
                {g.measurement && (
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">{t("reviews.indicatorLabel")}</span>
                    {g.measurement}
                  </p>
                )}
                {g.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
              </div>
              <div>
                <Label>{t("reviews.employeeComment")}</Label>
                <Textarea
                  rows={3}
                  value={selfComments[g.id] ?? ""}
                  onChange={(e) =>
                    setSelfComments((m) => ({ ...m, [g.id]: e.target.value }))
                  }
                  disabled={!isOwner}
                  placeholder={t("reviews.employeeCommentPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("reviews.selfAssessment")}</h2>
        <Textarea
          rows={4}
          value={selfGlobal}
          onChange={(e) => setSelfGlobal(e.target.value)}
          disabled={!isOwner}
          placeholder={t("reviews.selfAssessmentPlaceholder")}
        />
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Label>{t("reviews.myScore")}</Label>
            <Select
              value={selfScore ? String(selfScore) : ""}
              onValueChange={(v) => setSelfScore(Number(v))}
              disabled={!isOwner}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t("reviews.chooseScore")} />
              </SelectTrigger>
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
      </section>

      {isOwner && (
        <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <Button variant="outline" onClick={() => persist(false)} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {t("reviews.save")}
          </Button>
          <Button onClick={() => persist(true)} disabled={busy}>
            <Send className="mr-2 h-4 w-4" />
            {t("reviews.sendToManager")}
          </Button>
        </div>
      )}
    </div>
  );
}
