import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import {
  acceptsCheckins,
  createOkr,
  createOkrCheckin,
  deleteOkr,
  isOkrEditable,
  okrCheckinsQuery,
  okrsQuery,
  performanceKey,
  QUARTER_PATTERN,
  quarterOf,
  replaceKeyResults,
  requestOkrRevision,
  submitOkr,
  updateKeyResult,
  validateOkr,
  type KeyResult,
  type Okr,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/performance/okrs")({
  component: OkrsPage,
});

const MAX_KEY_RESULTS = 20;
const emptyForm = () => ({ objective: "", quarter: quarterOf(new Date()), keyResults: "" });

function OkrsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const access = usePerformanceAccess();

  const okrs = useQuery({ ...okrsQuery(organizationId), enabled: !!org });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sendBackFor, setSendBackFor] = useState<Okr | null>(null);
  const [sendBackComment, setSendBackComment] = useState("");
  const [openCheckins, setOpenCheckins] = useState<Record<string, boolean>>({});

  const schema = useMemo(
    () =>
      z.object({
        objective: z
          .string()
          .trim()
          .min(3, t("okrs.errors.objectiveMin"))
          .max(200, t("okrs.errors.objectiveMax")),
        quarter: z.string().trim().regex(QUARTER_PATTERN, t("okrs.errors.quarterFormat")),
        keyResults: z
          .array(z.string().trim().min(1).max(300, t("okrs.errors.keyResultMax")))
          .min(1, t("okrs.errors.keyResultsMin"))
          .max(MAX_KEY_RESULTS, t("okrs.errors.keyResultsMax")),
      }),
    [t],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const onError = (e: unknown) => {
    toast.error(apiErrorMessage(e));
    return refresh();
  };

  // The API creates the OKR in draft, then takes its key results as one list.
  const create = useMutation({
    mutationFn: async (input: z.infer<typeof schema>) => {
      const okr = await createOkr({ quarter: input.quarter, objective: input.objective });
      return replaceKeyResults(
        okr.id,
        input.keyResults.map((title) => ({ title })),
      );
    },
    onSuccess: () => {
      toast.success(t("okrs.createdSuccess"));
      setOpen(false);
      setForm(emptyForm());
      return refresh();
    },
    onError,
  });
  const toggleKr = useMutation({
    mutationFn: ({ okr, kr }: { okr: Okr; kr: KeyResult }) =>
      updateKeyResult(okr.id, kr.id, { isDone: !kr.isDone }),
    onSuccess: refresh,
    onError,
  });
  const submit = useMutation({
    mutationFn: (okr: Okr) => submitOkr(okr.id),
    onSuccess: () => {
      toast.success(t("okrs.submittedSuccess"));
      return refresh();
    },
    onError,
  });
  const validate = useMutation({
    mutationFn: (okr: Okr) => validateOkr(okr.id),
    onSuccess: () => {
      toast.success(t("okrs.validatedSuccess"));
      return refresh();
    },
    onError,
  });
  const sendBack = useMutation({
    mutationFn: ({ okr, comment }: { okr: Okr; comment: string }) =>
      requestOkrRevision(okr.id, comment),
    onSuccess: () => {
      toast.success(t("okrs.sentBackSuccess"));
      closeSendBack();
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (okr: Okr) => deleteOkr(okr.id),
    onSuccess: () => {
      toast.success(t("okrs.deletedSuccess"));
      return refresh();
    },
    onError,
  });
  const busy = submit.isPending || validate.isPending || sendBack.isPending;

  function closeSendBack() {
    setSendBackFor(null);
    setSendBackComment("");
  }

  const krList = form.keyResults
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const canSubmit = form.objective.trim().length >= 3 && krList.length >= 1 && !create.isPending;

  const save = () => {
    const parsed = schema.safeParse({
      objective: form.objective,
      quarter: form.quarter,
      keyResults: krList,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!access.myEmployeeId) return toast.error(t("okrs.errors.noEmployeeRecord"));
    create.mutate(parsed.data);
  };

  const askValidate = async (okr: Okr) => {
    const ok = await confirm({
      title: t("okrs.validateConfirm"),
      description: t("okrs.validateConfirmDesc"),
      actionLabel: t("okrs.validate"),
    });
    if (ok) validate.mutate(okr);
  };

  const askRemove = async (okr: Okr) => {
    const ok = await confirm({
      title: t("okrs.deleteConfirm"),
      description: t("okrs.deleteConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(okr);
  };

  const reviewBadge = (o: Okr) => {
    switch (o.reviewStatus) {
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning hover:bg-warning/10">
            {t("okrs.reviewStatuses.pending")}
          </Badge>
        );
      case "validated":
        return <Badge variant="success">{t("okrs.reviewStatuses.validated")}</Badge>;
      case "needs_revision":
        return <Badge variant="destructive">{t("okrs.reviewStatuses.needs_revision")}</Badge>;
      default:
        return <Badge variant="outline">{t("okrs.reviewStatuses.draft")}</Badge>;
    }
  };

  const items = okrs.data ?? [];

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("okrs.title")}
        description={t("okrs.description")}
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
                {t("okrs.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("okrs.newObjective")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="okr-objective">
                      {t("okrs.objective")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="okr-objective"
                      value={form.objective}
                      maxLength={200}
                      onChange={(e) => setForm({ ...form, objective: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="okr-quarter">
                      {t("okrs.quarter")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="okr-quarter"
                      placeholder={t("okrs.quarterPlaceholder")}
                      value={form.quarter}
                      maxLength={7}
                      onChange={(e) => setForm({ ...form, quarter: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="okr-krs">
                      {t("okrs.keyResults")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="okr-krs"
                      rows={4}
                      value={form.keyResults}
                      onChange={(e) => setForm({ ...form, keyResults: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("okrs.keyResultsHint")}</p>
                  </div>
                  <Button onClick={save} className="w-full" disabled={!canSubmit}>
                    {t("okrs.create")}
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog
        open={!!sendBackFor}
        onOpenChange={(v) => {
          if (!v) closeSendBack();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("okrs.sendBackTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">{t("okrs.sendBackDesc")}</p>
            <div className="mt-4">
              <Label htmlFor="okr-sendback">
                {t("okrs.managerComment")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="okr-sendback"
                rows={4}
                maxLength={2000}
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
                placeholder={t("okrs.managerCommentPlaceholder")}
              />
            </div>
            <DialogActions>
              <Button variant="outline" onClick={closeSendBack}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="outlineDanger"
                disabled={busy}
                onClick={() => {
                  const comment = sendBackComment.trim();
                  if (!comment) return toast.error(t("okrs.sendBackCommentRequired"));
                  if (sendBackFor) sendBack.mutate({ okr: sendBackFor, comment });
                }}
              >
                {t("okrs.sendBack")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {items.map((o) => {
          const mine = access.isSelf(o.employeeId);
          const canProgress = access.canProgress(o.employeeId);
          // The API refuses key result progress while pending, completed or archived.
          const krLocked =
            o.reviewStatus === "pending" || o.status === "completed" || o.status === "archived";
          const doneCount = o.keyResults.filter((k) => k.isDone).length;
          const allDone = o.keyResults.length > 0 && doneCount === o.keyResults.length;
          const canDelete = access.isAdmin || (mine && isOkrEditable(o));
          return (
            <Card key={o.id} data-testid="okr-card">
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold">{o.objective}</p>
                      {reviewBadge(o)}
                      {allDone ? (
                        <Badge variant="success">{t("okrs.achieved")}</Badge>
                      ) : doneCount > 0 ? (
                        <Badge className="bg-warning/10 text-warning">{t("okrs.inProgress")}</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.quarter} · {access.nameOf(o.employeeId) ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">{o.progress}%</span>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void askRemove(o)}
                        aria-label={t("okrs.deleteAria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Progress value={o.progress} />
                <ul className="mt-3 space-y-2 text-sm">
                  {o.keyResults.map((kr) => (
                    <li key={kr.id} className="flex items-start gap-2">
                      <Checkbox
                        checked={kr.isDone}
                        disabled={!canProgress || krLocked || toggleKr.isPending}
                        onCheckedChange={() => toggleKr.mutate({ okr: o, kr })}
                        aria-label={kr.title}
                        className="mt-0.5"
                      />
                      <span className={kr.isDone ? "text-muted-foreground line-through" : ""}>
                        {kr.title}
                      </span>
                    </li>
                  ))}
                </ul>

                {o.reviewStatus === "needs_revision" && o.managerComment && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-medium text-destructive">
                      {t("okrs.managerCommentTitle")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{o.managerComment}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {mine && isOkrEditable(o) && (
                    <Button size="sm" onClick={() => submit.mutate(o)} disabled={busy}>
                      <Send className="mr-2 h-4 w-4" />
                      {t("okrs.submitForValidation")}
                    </Button>
                  )}
                  {access.canDecide(o.employeeId) && o.reviewStatus === "pending" && (
                    <>
                      <Button size="sm" onClick={() => void askValidate(o)} disabled={busy}>
                        <Check className="mr-2 h-4 w-4" />
                        {t("okrs.validate")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outlineDanger"
                        onClick={() => setSendBackFor(o)}
                        disabled={busy}
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        {t("okrs.sendBack")}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={!!openCheckins[o.id]}
                    onClick={() => setOpenCheckins((p) => ({ ...p, [o.id]: !p[o.id] }))}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t("okrs.checkins")}
                  </Button>
                </div>

                {openCheckins[o.id] && <Checkins organizationId={organizationId} okr={o} />}
              </CardContent>
            </Card>
          );
        })}
        {!okrs.isPending && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {okrs.isError ? apiErrorMessage(okrs.error) : t("okrs.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Check-ins of one OKR, read when the panel opens. */
function Checkins({ organizationId, okr }: { organizationId: string; okr: Okr }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const access = usePerformanceAccess();
  const checkins = useQuery(okrCheckinsQuery(organizationId, okr.id));
  const [draft, setDraft] = useState("");
  const add = useMutation({
    mutationFn: (message: string) => createOkrCheckin(okr.id, message),
    onSuccess: () => {
      toast.success(t("okrs.checkinAdded"));
      setDraft("");
      return queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const list = checkins.data ?? [];
  const open = acceptsCheckins(okr);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      {checkins.isSuccess && list.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("okrs.noCheckins")}</p>
      )}
      {list.map((c) => (
        <div key={c.id} className="rounded-md bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {(c.authorEmployeeId && access.nameOf(c.authorEmployeeId)) || "—"} ·{" "}
            {new Date(c.createdAt).toLocaleDateString()} · {c.progressSnapshot}%
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{c.message}</p>
        </div>
      ))}
      {open ? (
        <div className="space-y-2">
          <Textarea
            rows={2}
            maxLength={5000}
            value={draft}
            aria-label={t("okrs.checkins")}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("okrs.checkinPlaceholder")}
          />
          <Button
            size="sm"
            onClick={() => add.mutate(draft.trim())}
            disabled={add.isPending || !draft.trim()}
          >
            {t("okrs.addCheckin")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("okrs.checkinsClosed")}</p>
      )}
    </div>
  );
}
