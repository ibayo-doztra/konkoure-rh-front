import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { allEmployeesQuery } from "@/lib/api/hr";
import {
  ATTENDANCE_ANOMALIES,
  attendanceQuery,
  type AttendanceAnomaly,
  type AttendanceDay,
} from "@/lib/api/timeclock";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportLogsDialog } from "@/components/timeclock/ExportLogsDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";

export const Route = createFileRoute("/_authenticated/app/timeclock/logs")({
  component: LogsPage,
});

const MAX_RANGE_DAYS = 93;

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Attendance days computed by the API from the punches (first arrival, last
 * departure, worked time, anomaly). The API scopes them: everyone for owner,
 * hr_admin and security agents, the team and oneself for a manager, oneself
 * otherwise.
 */
function LogsPage() {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";
  const [from, setFrom] = useState(() => isoDay(-29));
  const [to, setTo] = useState(() => isoDay(0));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // Exports are for owner and hr_admin only (06 §6).
  const { isAdmin } = useRole();
  const [anomaly, setAnomaly] = useState<AttendanceAnomaly | "all">("all");

  const rangeValid = !!from && !!to && from <= to && daysBetween(from, to) < MAX_RANGE_DAYS;
  const attendance = useQuery({
    ...attendanceQuery(organizationId, {
      page,
      from,
      to,
      anomaly: anomaly === "all" ? undefined : anomaly,
    }),
    enabled: !!org && rangeValid,
  });
  const lastPage = attendance.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const employees = useQuery({ ...allEmployeesQuery(organizationId), enabled: !!org });
  const names = useMemo(
    () => new Map((employees.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
    [employees.data],
  );

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—";

  const status = (d: AttendanceDay) => {
    if (d.anomaly) {
      return (
        <Badge variant="destructive">
          {t(`timeclock.anomaly.${d.anomaly}`, { defaultValue: d.anomaly })}
        </Badge>
      );
    }
    return d.isComplete ? (
      <Badge variant="secondary">{t("timeclock.logs.status.finished")}</Badge>
    ) : (
      <Badge>{t("timeclock.logs.status.ongoing")}</Badge>
    );
  };

  return (
    <div>
      <PageHeader
        title={t("timeclock.logs.title")}
        description={t("timeclock.logs.description")}
        actions={
          isAdmin ? (
            <Button variant="outline" onClick={() => setExporting(true)}>
              <Download className="mr-2 h-4 w-4" />
              {t("timeclock.export.open")}
            </Button>
          ) : undefined
        }
      />
      {exporting && (
        <ExportLogsDialog defaultFrom={from} defaultTo={to} onClose={() => setExporting(false)} />
      )}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="attendance-from">{t("timeclock.logs.from")}</Label>
            <Input
              id="attendance-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="attendance-to">{t("timeclock.logs.to")}</Label>
            <Input
              id="attendance-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="attendance-anomaly">{t("timeclock.logs.anomalyFilter")}</Label>
            <Select
              value={anomaly}
              onValueChange={(v) => {
                setAnomaly(v as AttendanceAnomaly | "all");
                setPage(1);
              }}
            >
              <SelectTrigger id="attendance-anomaly" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeclock.logs.allAnomalies")}</SelectItem>
                {ATTENDANCE_ANOMALIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`timeclock.anomaly.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!rangeValid && (
            <p className="text-sm text-destructive">
              {t("timeclock.logs.rangeError", { max: MAX_RANGE_DAYS })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b bg-muted/30 p-3 text-sm font-semibold">
            {t("timeclock.logs.sessionsTitle")}
          </div>
          <ResponsiveTable
            data={rangeValid ? (attendance.data?.data ?? []) : []}
            getRowKey={(d) => `${d.employeeId}-${d.day}`}
            empty={t("timeclock.logs.empty")}
            columns={[
              {
                key: "employee",
                header: t("timeclock.logs.columns.employee"),
                priority: "primary",
                cell: (d) => <span className="break-words">{names.get(d.employeeId) ?? "—"}</span>,
              },
              {
                key: "day",
                header: t("timeclock.logs.columns.day"),
                cell: (d) => (
                  <span className="whitespace-nowrap text-muted-foreground">
                    {new Date(`${d.day}T00:00:00`).toLocaleDateString(locale)}
                  </span>
                ),
              },
              {
                key: "arrivee",
                header: t("timeclock.logs.columns.arrivee"),
                cell: (d) => <span className="tabular-nums">{time(d.firstIn)}</span>,
              },
              {
                key: "depart",
                header: t("timeclock.logs.columns.depart"),
                cell: (d) => <span className="tabular-nums">{time(d.lastOut)}</span>,
              },
              {
                key: "duree",
                header: t("timeclock.logs.columns.duree"),
                cell: (d) => (
                  <span className="tabular-nums">
                    {d.workedMinutes > 0 ? formatMinutes(d.workedMinutes) : "—"}
                  </span>
                ),
              },
              {
                key: "retard",
                header: t("timeclock.logs.columns.retard"),
                cell: (d) => (
                  <span className="tabular-nums text-muted-foreground">
                    {d.lateMinutes ? t("timeclock.logs.lateBy", { minutes: d.lateMinutes }) : "—"}
                  </span>
                ),
              },
              {
                key: "statut",
                header: t("timeclock.logs.columns.statut"),
                priority: "actions",
                cell: status,
              },
            ]}
          />
          <div className="px-4 pb-3">
            <ListPager page={page} lastPage={lastPage} onChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
