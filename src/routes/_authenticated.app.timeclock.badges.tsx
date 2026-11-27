import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { allEmployeesQuery, badgeJournalQuery, type NfcBadgeEvent } from "@/lib/api/hr";
import { allMembersQuery } from "@/lib/api/organization";
import { apiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/hooks/useOrg";
import { badgeEventLabel } from "@/components/employees/NfcBadgeCard";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/timeclock/badges")({
  component: BadgeJournalPage,
});

const ALL = "__all__";

function eventVariant(event: string) {
  if (event === "assigned") return "default" as const;
  if (event === "scan_rejected") return "destructive" as const;
  return "outline" as const;
}

/** Organization-wide NFC badge journal (06 §6, owner and hr_admin). */
function BadgeJournalPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState(ALL);

  const journal = useQuery({
    ...badgeJournalQuery(organizationId, {
      page,
      employeeId: employeeId === ALL ? undefined : employeeId,
    }),
    enabled: !!org,
  });
  const lastPage = journal.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const employees = useQuery({ ...allEmployeesQuery(organizationId), enabled: !!org });
  const members = useQuery({ ...allMembersQuery(organizationId), enabled: !!org });
  const employeeNames = useMemo(
    () =>
      new Map((employees.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`] as const)),
    [employees.data],
  );
  const memberNames = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.fullName ?? m.email] as const)),
    [members.data],
  );
  const sortedEmployees = useMemo(
    () => [...employeeNames].sort(([, a], [, b]) => a.localeCompare(b)),
    [employeeNames],
  );

  const employeeCell = (event: NfcBadgeEvent) =>
    event.employeeId ? (
      <span className="break-words">{employeeNames.get(event.employeeId) ?? "—"}</span>
    ) : (
      <span className="text-muted-foreground">{t("timeclock.badges.unknownBadge")}</span>
    );

  // A kiosk scan has no member behind it.
  const actorCell = (event: NfcBadgeEvent) => (
    <span className="break-words text-muted-foreground">
      {event.actorUserId
        ? (memberNames.get(event.actorUserId) ?? "—")
        : t("timeclock.badges.kiosk")}
    </span>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("timeclock.badges.title")}
        description={t("timeclock.badges.description")}
      />

      <Card>
        <CardContent className="p-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="badge-employee">{t("timeclock.badges.employee")}</Label>
            <Select
              value={employeeId}
              onValueChange={(value) => {
                setEmployeeId(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="badge-employee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("timeclock.badges.allEmployees")}</SelectItem>
                {sortedEmployees.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="badge-journal">
        <CardContent className="p-0">
          {journal.error ? (
            <p className="p-4 text-sm text-destructive">{apiErrorMessage(journal.error)}</p>
          ) : (
            <ResponsiveTable
              data={journal.data?.data ?? []}
              getRowKey={(event) => event.id}
              empty={journal.isPending ? "…" : t("timeclock.badges.empty")}
              columns={[
                {
                  key: "employee",
                  header: t("timeclock.badges.columns.employee"),
                  priority: "primary",
                  cell: employeeCell,
                },
                {
                  key: "date",
                  header: t("timeclock.badges.columns.date"),
                  cell: (event) => (
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </span>
                  ),
                },
                {
                  key: "uid",
                  header: t("timeclock.badges.columns.uid"),
                  cell: (event) => <span className="font-mono text-xs">{event.uid}</span>,
                },
                {
                  key: "actor",
                  header: t("timeclock.badges.columns.actor"),
                  cell: actorCell,
                },
                {
                  key: "event",
                  header: t("timeclock.badges.columns.event"),
                  priority: "actions",
                  cell: (event) => (
                    <Badge variant={eventVariant(event.event)}>
                      {badgeEventLabel(event.event, t)}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
          <div className="px-4 pb-3">
            <ListPager page={page} lastPage={lastPage} onChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
