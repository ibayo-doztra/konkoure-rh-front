import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarClock, Loader2, Moon, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import { directoryQuery } from "@/lib/api/hr";
import { organizationQuery, updateOrganizationSettings } from "@/lib/api/organization";
import {
  createSchedule,
  DEFAULT_LATE_TOLERANCE,
  deleteSchedule,
  isNightSlot,
  lateTolerance,
  MAX_LATE_TOLERANCE,
  MAX_SLOTS_PER_DAY,
  schedulesQuery,
  timeclockKey,
  updateSchedule,
  WEEK_DAYS,
  type ScheduleInput,
  type ScheduleSlot,
  type WeekDay,
  type WeeklyPattern,
  type WorkSchedule,
} from "@/lib/api/timeclock";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/timeclock/schedules")({
  component: SchedulesPage,
});

const OFFICE_DAY: ScheduleSlot[] = [
  { start: "08:00", end: "12:00" },
  { start: "13:00", end: "17:00" },
];

const newPattern = (): WeeklyPattern => ({
  mon: [...OFFICE_DAY],
  tue: [...OFFICE_DAY],
  wed: [...OFFICE_DAY],
  thu: [...OFFICE_DAY],
  fri: [...OFFICE_DAY],
  sat: [],
  sun: [],
});

/**
 * Weekly schedules used to compute lateness and night shifts (06 §6). An employee
 * follows their own schedule, otherwise the default one, otherwise none. Managers and
 * security agents read them; owner and hr_admin edit them and the late tolerance.
 */
function SchedulesPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<WorkSchedule | "new" | null>(null);

  const schedules = useQuery({ ...schedulesQuery(organizationId), enabled: !!org });
  const directory = useQuery({ ...directoryQuery(organizationId), enabled: !!org });
  const names = useMemo(
    () => new Map((directory.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
    [directory.data],
  );

  const remove = useMutation({
    mutationFn: (schedule: WorkSchedule) => deleteSchedule(schedule.id),
    onSuccess: () => {
      toast.success(t("timeclock.schedules.deleted"));
      return queryClient.invalidateQueries({ queryKey: schedulesQuery(organizationId).queryKey });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onDelete = async (schedule: WorkSchedule) => {
    const confirmed = await confirm({
      title: t("timeclock.schedules.deleteTitle"),
      subtitle: schedule.name,
      description: t("timeclock.schedules.deleteDescription"),
      actionLabel: t("timeclock.schedules.delete"),
      actionVariant: "destructive",
    });
    if (confirmed) remove.mutate(schedule);
  };

  const items = schedules.data ?? [];

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title={t("timeclock.schedules.title")}
        description={t("timeclock.schedules.description")}
        actions={
          isAdmin ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("timeclock.schedules.new")}
            </Button>
          ) : undefined
        }
      />

      {isAdmin && <ToleranceCard />}

      {schedules.isPending ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">{t("timeclock.schedules.emptyTitle")}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("timeclock.schedules.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((schedule) => (
            <Card key={schedule.id} data-testid="schedule-card">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="break-words font-semibold">{schedule.name}</h2>
                    {schedule.isDefault ? (
                      <Badge>{t("timeclock.schedules.default")}</Badge>
                    ) : schedule.employeeId ? (
                      <Badge variant="secondary">
                        {t("timeclock.schedules.ownOf", {
                          name: names.get(schedule.employeeId) ?? "—",
                        })}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t("timeclock.schedules.template")}</Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("timeclock.schedules.editFor", { name: schedule.name })}
                        onClick={() => setEditing(schedule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!schedule.isDefault && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("timeclock.schedules.deleteFor", { name: schedule.name })}
                          disabled={remove.isPending}
                          onClick={() => void onDelete(schedule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <WeekSummary pattern={schedule.weeklyPattern} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ScheduleDialog
          schedule={editing === "new" ? null : editing}
          employees={directory.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function WeekSummary({ pattern }: { pattern: WeeklyPattern }) {
  const { t } = useTranslation();
  return (
    <dl className="grid gap-1 text-sm">
      {WEEK_DAYS.map((day) => {
        const slots = pattern[day] ?? [];
        return (
          <div key={day} className="flex gap-3">
            <dt className="w-24 shrink-0 text-muted-foreground">
              {t(`timeclock.schedules.days.${day}`)}
            </dt>
            <dd className="tabular-nums">
              {slots.length === 0 ? (
                <span className="text-muted-foreground">{t("timeclock.schedules.dayOff")}</span>
              ) : (
                slots.map((slot, i) => (
                  <span key={i} className="mr-3 inline-flex items-center gap-1 whitespace-nowrap">
                    {slot.start}–{slot.end}
                    {isNightSlot(slot) && (
                      <Moon
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-label={t("timeclock.schedules.nextDay")}
                      />
                    )}
                  </span>
                ))
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

type Scope = "template" | "employee";

function ScheduleDialog({
  schedule,
  employees,
  onClose,
}: {
  schedule: WorkSchedule | null;
  employees: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [name, setName] = useState(schedule?.name ?? "");
  const [scope, setScope] = useState<Scope>(schedule?.employeeId ? "employee" : "template");
  const [employeeId, setEmployeeId] = useState(schedule?.employeeId ?? "");
  const [isDefault, setIsDefault] = useState(schedule?.isDefault ?? false);
  const [pattern, setPattern] = useState<WeeklyPattern>(() =>
    schedule
      ? (Object.fromEntries(
          WEEK_DAYS.map((d) => [d, [...(schedule.weeklyPattern[d] ?? [])]]),
        ) as WeeklyPattern)
      : newPattern(),
  );

  const save = useMutation({
    mutationFn: () => {
      const input: ScheduleInput = {
        name: name.trim(),
        isDefault: scope === "template" && isDefault,
        weeklyPattern: pattern,
        employeeId: scope === "employee" ? employeeId : null,
      };
      return schedule ? updateSchedule(schedule.id, input) : createSchedule(input);
    },
    onSuccess: () => {
      toast.success(t(schedule ? "timeclock.schedules.updated" : "timeclock.schedules.created"));
      onClose();
      return queryClient.invalidateQueries({ queryKey: timeclockKey(organizationId) });
    },
  });

  const setDay = (day: WeekDay, slots: ScheduleSlot[]) =>
    setPattern((prev) => ({ ...prev, [day]: slots }));

  const updateSlot = (day: WeekDay, index: number, change: Partial<ScheduleSlot>) =>
    setDay(
      day,
      pattern[day].map((slot, i) => (i === index ? { ...slot, ...change } : slot)),
    );

  const copyMondayToWeekdays = () =>
    setPattern((prev) => ({
      ...prev,
      tue: [...prev.mon],
      wed: [...prev.mon],
      thu: [...prev.mon],
      fri: [...prev.mon],
    }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (scope === "employee" && !employeeId) {
      toast.error(t("timeclock.schedules.employeeRequired"));
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t(schedule ? "timeclock.schedules.editTitle" : "timeclock.schedules.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("timeclock.schedules.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-name">{t("timeclock.schedules.name")}</Label>
                <Input
                  id="schedule-name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-scope">{t("timeclock.schedules.scope")}</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                  <SelectTrigger id="schedule-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">
                      {t("timeclock.schedules.scopeTemplate")}
                    </SelectItem>
                    <SelectItem value="employee">
                      {t("timeclock.schedules.scopeEmployee")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === "employee" ? (
                <div className="space-y-2">
                  <Label htmlFor="schedule-employee">{t("timeclock.schedules.employee")}</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger id="schedule-employee">
                      <SelectValue placeholder={t("timeclock.schedules.chooseEmployee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-3 self-end pb-2">
                  <Switch
                    id="schedule-default"
                    checked={isDefault}
                    // The default schedule stays the default until another one takes over.
                    disabled={schedule?.isDefault}
                    onCheckedChange={setIsDefault}
                  />
                  <Label htmlFor="schedule-default">{t("timeclock.schedules.isDefault")}</Label>
                </div>
              )}
            </div>

            <fieldset className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="font-medium">{t("timeclock.schedules.week")}</legend>
                <Button type="button" variant="outline" size="sm" onClick={copyMondayToWeekdays}>
                  {t("timeclock.schedules.copyMonday")}
                </Button>
              </div>
              {WEEK_DAYS.map((day) => {
                const dayLabel = t(`timeclock.schedules.days.${day}`);
                const slots = pattern[day];
                return (
                  <div
                    key={day}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
                    data-testid={`schedule-day-${day}`}
                  >
                    <span className="w-24 shrink-0 pt-2 text-sm font-medium">{dayLabel}</span>
                    <div className="flex-1 space-y-2">
                      {slots.length === 0 && (
                        <p className="pt-2 text-sm text-muted-foreground">
                          {t("timeclock.schedules.dayOff")}
                        </p>
                      )}
                      {slots.map((slot, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            required
                            className="w-32"
                            aria-label={t("timeclock.schedules.slotStart", {
                              day: dayLabel,
                              n: i + 1,
                            })}
                            value={slot.start}
                            onChange={(e) => updateSlot(day, i, { start: e.target.value })}
                          />
                          <span aria-hidden="true">–</span>
                          <Input
                            type="time"
                            required
                            className="w-32"
                            aria-label={t("timeclock.schedules.slotEnd", {
                              day: dayLabel,
                              n: i + 1,
                            })}
                            value={slot.end}
                            onChange={(e) => updateSlot(day, i, { end: e.target.value })}
                          />
                          {slot.start && slot.end && isNightSlot(slot) && (
                            <Badge variant="secondary" className="gap-1">
                              <Moon className="h-3 w-3" aria-hidden="true" />
                              {t("timeclock.schedules.nextDay")}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("timeclock.schedules.removeSlot", {
                              day: dayLabel,
                              n: i + 1,
                            })}
                            onClick={() =>
                              setDay(
                                day,
                                slots.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {slots.length < MAX_SLOTS_PER_DAY && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0 self-start"
                        aria-label={t("timeclock.schedules.addSlotFor", { day: dayLabel })}
                        onClick={() => setDay(day, [...slots, { start: "08:00", end: "17:00" }])}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {t("timeclock.schedules.addSlot")}
                      </Button>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">{t("timeclock.schedules.nightHint")}</p>
            </fieldset>

            {save.error && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(save.error)}
              </p>
            )}

            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("timeclock.schedules.cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("timeclock.schedules.save")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ToleranceCard() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const detail = useQuery({ ...organizationQuery(organizationId), enabled: !!org });
  const saved = lateTolerance(detail.data?.settings);
  const [value, setValue] = useState<string | null>(null);
  const shown = value ?? String(saved);
  const minutes = Number(shown);
  const invalid =
    shown === "" || !Number.isInteger(minutes) || minutes < 0 || minutes > MAX_LATE_TOLERANCE;

  const save = useMutation({
    mutationFn: async () => {
      // The PUT replaces the whole block: start from the saved settings.
      const current = await queryClient.fetchQuery(organizationQuery(organizationId));
      const settings = (current.settings ?? {}) as Record<string, unknown>;
      const timeclock = (settings.timeclock ?? {}) as Record<string, unknown>;
      return updateOrganizationSettings({
        ...settings,
        timeclock: { ...timeclock, lateToleranceMinutes: minutes },
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(organizationQuery(organizationId).queryKey, updated);
      setValue(null);
      toast.success(t("timeclock.schedules.toleranceSaved"));
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid) save.mutate();
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="space-y-1">
            <h2 className="font-semibold">{t("timeclock.schedules.toleranceTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("timeclock.schedules.toleranceHint", { default: DEFAULT_LATE_TOLERANCE })}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="late-tolerance">{t("timeclock.schedules.toleranceLabel")}</Label>
              <Input
                id="late-tolerance"
                type="number"
                min={0}
                max={MAX_LATE_TOLERANCE}
                step={1}
                className="w-28"
                disabled={detail.isPending}
                aria-invalid={invalid || undefined}
                value={shown}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={invalid || save.isPending || minutes === saved}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("timeclock.schedules.toleranceSave")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
