import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createFeedback,
  deleteFeedback,
  FEEDBACK_KINDS,
  feedbackQuery,
  okrsQuery,
  performanceKey,
  type Feedback,
  type FeedbackKind,
} from "@/lib/api/performance";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { usePerformanceAccess } from "@/hooks/usePerformanceAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/app/performance/feedback")({
  component: FeedbackPage,
});

const NO_OKR = "none";
const EMPTY_FORM = { to: "", kind: "kudos" as FeedbackKind, message: "", okr: NO_OKR };

function FeedbackPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const access = usePerformanceAccess();
  const me = access.myEmployeeId;
  const feedback = useQuery({ ...feedbackQuery(organizationId), enabled: !!org });
  const okrs = useQuery({ ...okrsQuery(organizationId), enabled: !!org });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const items = useMemo(() => feedback.data ?? [], [feedback.data]);
  const received = items.filter((f) => !!me && f.toEmployeeId === me);
  const sent = items.filter((f) => !!me && f.fromEmployeeId === me);
  // The API already limits a manager to his team, and gives HR everything.
  const team = items.filter((f) => f.toEmployeeId !== me && f.fromEmployeeId !== me);
  const showTeam = access.isAdmin || access.isManager;

  // No feedback to oneself (422).
  const options = access.employees
    .filter((e) => e.id !== me)
    .map((e) => ({
      id: e.id,
      first_name: e.firstName,
      last_name: e.lastName,
      photo_url: e.photoUrl,
      position: e.jobTitle,
    }));
  const recipientOkrs = (okrs.data ?? []).filter((o) => o.employeeId === form.to);

  const refresh = () => queryClient.invalidateQueries({ queryKey: performanceKey(organizationId) });
  const send = useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      toast.success(t("feedback.sentSuccess"));
      setOpen(false);
      setForm(EMPTY_FORM);
      return refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (f: Feedback) => deleteFeedback(f.id),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = () => {
    if (!form.to) return toast.error(t("feedback.errors.recipientRequired"));
    if (form.message.trim().length < 3) return toast.error(t("feedback.errors.messageRequired"));
    if (!me) return toast.error(t("feedback.errors.noEmployeeRecord"));
    send.mutate({
      toEmployeeId: form.to,
      kind: form.kind,
      message: form.message.trim(),
      okrId: form.okr === NO_OKR ? undefined : form.okr,
    });
  };

  // The author or HR, never the recipient (06 §9).
  const canDelete = (f: Feedback) =>
    (!!me && f.fromEmployeeId === me) || (access.isAdmin && f.toEmployeeId !== me);

  const askRemove = async (f: Feedback) => {
    const ok = await confirm({
      title: t("feedback.deleteConfirm"),
      description: t("feedback.deleteConfirmDesc"),
      actionLabel: t("common.delete"),
      actionVariant: "destructive",
    });
    if (ok) remove.mutate(f);
  };

  const kindBadge = (kind: FeedbackKind) => {
    if (kind === "kudos") return <Badge variant="success">{t("feedback.kinds.kudos")}</Badge>;
    if (kind === "concern") {
      return <Badge variant="destructive">{t("feedback.kinds.concern")}</Badge>;
    }
    return (
      <Badge className="bg-warning/10 text-warning hover:bg-warning/10">
        {t("feedback.kinds.suggestion")}
      </Badge>
    );
  };

  // Null author: a private feedback. Unknown name: a colleague outside what the reader may list.
  const name = (id: string | null) =>
    id ? (access.nameOf(id) ?? t("feedback.colleague")) : t("feedback.anonymous");

  const renderList = (list: Feedback[]) => (
    <div className="grid gap-3">
      {list.map((f) => {
        const okr = f.okrId ? okrs.data?.find((o) => o.id === f.okrId) : undefined;
        return (
          <Card key={f.id} data-testid="feedback-card">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {kindBadge(f.kind)}
                  <span className="text-sm font-medium">
                    {name(f.fromEmployeeId)} → {name(f.toEmployeeId)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</span>
                  {canDelete(f) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("feedback.deleteAria")}
                      onClick={() => void askRemove(f)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
              {okr && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("feedback.linkedOkr")}: {okr.objective}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {feedback.isError ? apiErrorMessage(feedback.error) : t("feedback.empty")}
        </p>
      )}
    </div>
  );

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title={t("feedback.title")}
        description={t("feedback.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setForm(EMPTY_FORM);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("feedback.give")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("feedback.give")}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-5">
                  <div>
                    <Label>
                      {t("feedback.recipient")} <span className="text-destructive">*</span>
                    </Label>
                    <EmployeeCombobox
                      value={form.to}
                      onChange={(v) => setForm({ ...form, to: v, okr: NO_OKR })}
                      options={options}
                      placeholder={t("feedback.choosePerson")}
                      searchPlaceholder={t("feedback.searchPerson")}
                      emptyMessage={t("feedback.noPersonFound")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="feedback-kind">{t("feedback.kind")}</Label>
                    <Select
                      value={form.kind}
                      onValueChange={(v) => setForm({ ...form, kind: v as FeedbackKind })}
                    >
                      <SelectTrigger id="feedback-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEEDBACK_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {t(`feedback.kinds.${k}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {recipientOkrs.length > 0 && (
                    <div>
                      <Label htmlFor="feedback-okr">{t("feedback.linkedOkr")}</Label>
                      <Select value={form.okr} onValueChange={(v) => setForm({ ...form, okr: v })}>
                        <SelectTrigger id="feedback-okr">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_OKR}>{t("feedback.noOkr")}</SelectItem>
                          {recipientOkrs.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.objective}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="feedback-message">
                      {t("feedback.message")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="feedback-message"
                      rows={4}
                      maxLength={5000}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={t("feedback.messagePlaceholder")}
                    />
                  </div>
                  <DialogActions>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={submit} disabled={send.isPending}>
                      {t("feedback.send")}
                    </Button>
                  </DialogActions>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">
            {t("feedback.tabs.received")} ({received.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            {t("feedback.tabs.sent")} ({sent.length})
          </TabsTrigger>
          {showTeam && (
            <TabsTrigger value="team">
              {t("feedback.tabs.team")} ({team.length})
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="received" className="mt-4">
          {renderList(received)}
        </TabsContent>
        <TabsContent value="sent" className="mt-4">
          {renderList(sent)}
        </TabsContent>
        {showTeam && (
          <TabsContent value="team" className="mt-4">
            {renderList(team)}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
