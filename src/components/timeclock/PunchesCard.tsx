import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import {
  correctTimeLog,
  deleteTimeLog,
  timeclockKey,
  timeLogsQuery,
  type PunchType,
  type TimeLog,
} from "@/lib/api/timeclock";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** `YYYY-MM-DDTHH:MM` in the browser's time zone, for a datetime-local input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Raw punches of the period (06 §6). Everyone sees the punches in their scope;
 * owner and hr_admin correct or delete them, audited by the API, which then
 * recomputes the attendance days.
 */
export function PunchesCard({
  from,
  to,
  names,
  canCorrect,
}: {
  /** Local dates `YYYY-MM-DD`. */
  from: string;
  to: string;
  names: Map<string, string>;
  canCorrect: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TimeLog | null>(null);

  const logs = useQuery({
    ...timeLogsQuery(organizationId, {
      page,
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59.999`).toISOString(),
    }),
    enabled: !!org && !!from && !!to && from <= to,
  });
  const lastPage = logs.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const remove = useMutation({
    mutationFn: (log: TimeLog) => deleteTimeLog(log.id),
    onSuccess: () => {
      toast.success(t("timeclock.punches.deleted"));
      return queryClient.invalidateQueries({ queryKey: timeclockKey(organizationId) });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const label = (log: TimeLog) =>
    `${names.get(log.employeeId) ?? "—"} · ${new Date(log.punchedAt).toLocaleString(locale)}`;

  const onDelete = async (log: TimeLog) => {
    const confirmed = await confirm({
      title: t("timeclock.punches.deleteTitle"),
      subtitle: label(log),
      description: t("timeclock.punches.deleteDescription"),
      actionLabel: t("timeclock.punches.delete"),
      actionVariant: "destructive",
    });
    if (confirmed) remove.mutate(log);
  };

  return (
    <Card data-testid="punches-card">
      {confirmDialog}
      <CardContent className="p-0">
        <div className="border-b bg-muted/30 p-3 text-sm font-semibold">
          {t("timeclock.punches.title")}
        </div>
        <ResponsiveTable
          data={logs.data?.data ?? []}
          getRowKey={(log) => log.id}
          empty={t("timeclock.punches.empty")}
          columns={[
            {
              key: "employee",
              header: t("timeclock.logs.columns.employee"),
              priority: "primary",
              cell: (log) => (
                <span className="break-words">{names.get(log.employeeId) ?? "—"}</span>
              ),
            },
            {
              key: "type",
              header: t("timeclock.punches.type"),
              cell: (log) => (
                <Badge variant={log.type === "in" ? "default" : "secondary"}>
                  {t(`timeclock.punches.types.${log.type}`)}
                </Badge>
              ),
            },
            {
              key: "at",
              header: t("timeclock.punches.at"),
              cell: (log) => (
                <span className="whitespace-nowrap tabular-nums">
                  {new Date(log.punchedAt).toLocaleString(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              ),
            },
            {
              key: "source",
              header: t("timeclock.punches.source"),
              cell: (log) => (
                <span className="text-muted-foreground">
                  {t(`timeclock.punches.sources.${log.source}`, { defaultValue: log.source })}
                </span>
              ),
            },
            {
              key: "notes",
              header: t("timeclock.punches.notes"),
              cell: (log) => (
                <span className="break-words text-muted-foreground">
                  {log.anomaly && (
                    <Badge variant="destructive" className="mr-2">
                      {t(`timeclock.anomaly.${log.anomaly}`)}
                    </Badge>
                  )}
                  {log.notes ?? ""}
                </span>
              ),
            },
            ...(canCorrect
              ? [
                  {
                    key: "actions",
                    header: "",
                    priority: "actions" as const,
                    cell: (log: TimeLog) => (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("timeclock.punches.editFor", { label: label(log) })}
                          onClick={() => setEditing(log)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={remove.isPending}
                          aria-label={t("timeclock.punches.deleteFor", { label: label(log) })}
                          onClick={() => void onDelete(log)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <div className="px-4 pb-3">
          <ListPager page={page} lastPage={lastPage} onChange={setPage} />
        </div>
      </CardContent>
      {editing && (
        <CorrectPunchDialog log={editing} title={label(editing)} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function CorrectPunchDialog({
  log,
  title,
  onClose,
}: {
  log: TimeLog;
  title: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [type, setType] = useState<PunchType>(log.type);
  const [at, setAt] = useState(toLocalInput(log.punchedAt));
  const [notes, setNotes] = useState(log.notes ?? "");

  const save = useMutation({
    mutationFn: () => {
      const changes: { type?: PunchType; punchedAt?: string; notes?: string | null } = {};
      if (type !== log.type) changes.type = type;
      const punchedAt = new Date(at).toISOString();
      if (punchedAt !== new Date(toLocalInput(log.punchedAt)).toISOString()) {
        changes.punchedAt = punchedAt;
      }
      const trimmed = notes.trim();
      if (trimmed !== (log.notes ?? "")) changes.notes = trimmed || null;
      return correctTimeLog(log.id, changes);
    },
    onSuccess: () => {
      toast.success(t("timeclock.punches.corrected"));
      onClose();
      // The attendance days of the punch are recomputed too.
      return queryClient.invalidateQueries({ queryKey: timeclockKey(organizationId) });
    },
  });

  const unchanged =
    type === log.type && at === toLocalInput(log.punchedAt) && notes.trim() === (log.notes ?? "");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!unchanged) save.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("timeclock.punches.correctTitle")}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="punch-type">{t("timeclock.punches.type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as PunchType)}>
                  <SelectTrigger id="punch-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{t("timeclock.punches.types.in")}</SelectItem>
                    <SelectItem value="out">{t("timeclock.punches.types.out")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="punch-at">{t("timeclock.punches.at")}</Label>
                <Input
                  id="punch-at"
                  type="datetime-local"
                  required
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="punch-notes">{t("timeclock.punches.reason")}</Label>
              <Textarea
                id="punch-notes"
                maxLength={1000}
                rows={3}
                placeholder={t("timeclock.punches.reasonPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("timeclock.punches.audited")}</p>
            {save.error && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(save.error)}
              </p>
            )}
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("timeclock.punches.cancel")}
              </Button>
              <Button type="submit" disabled={unchanged || save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("timeclock.punches.save")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
