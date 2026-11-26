import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import { departmentsQuery } from "@/lib/api/hr";
import { todayQuery, type TodayPerson, type TodayPresent } from "@/lib/api/timeclock";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/timeclock/today")({
  component: TodayPage,
});

type Group = "present" | "absent" | "onLeave";

/**
 * Who is present, absent or on leave today (06 §6). Owner, hr_admin and security
 * agents see everyone, a manager their team and themselves. Refreshed every minute.
 */
function TodayPage() {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";
  const [group, setGroup] = useState<Group>("present");

  const today = useQuery({ ...todayQuery(organizationId), enabled: !!org });
  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: !!org });
  const departmentNames = useMemo(
    () => new Map((departments.data ?? []).map((d) => [d.id, d.name])),
    [departments.data],
  );

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—";

  const nameCell = (p: TodayPerson) => (
    <Link
      to="/app/employees/$id"
      params={{ id: p.employeeId }}
      className="break-words font-medium hover:underline"
    >
      {p.fullName}
    </Link>
  );
  const departmentCell = (p: TodayPerson) => (
    <span className="text-muted-foreground">
      {(p.departmentId && departmentNames.get(p.departmentId)) || "—"}
    </span>
  );

  if (today.isError) {
    return <div className="p-8 text-muted-foreground">{apiErrorMessage(today.error)}</div>;
  }

  const data = today.data;
  const counts: { key: Group; label: string; value: number | undefined }[] = [
    { key: "present", label: t("timeclock.today.present"), value: data?.counts.present },
    { key: "absent", label: t("timeclock.today.absent"), value: data?.counts.absent },
    { key: "onLeave", label: t("timeclock.today.onLeave"), value: data?.counts.onLeave },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("timeclock.today.title")}
        description={
          data
            ? new Date(`${data.date}T00:00:00`).toLocaleDateString(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : t("timeclock.today.description")
        }
      />

      {data?.isHoliday && (
        <p className="rounded-md bg-muted p-3 text-sm">{t("timeclock.today.holiday")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <Card key={c.key}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              {c.value === undefined ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p
                  className="mt-1 text-3xl font-semibold tabular-nums"
                  data-testid={`today-${c.key}`}
                >
                  {c.value}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    / {data?.counts.total}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={group} onValueChange={(v) => setGroup(v as Group)}>
        <TabsList>
          {counts.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {group === "present" ? (
            <ResponsiveTable<TodayPresent>
              data={data?.present ?? []}
              getRowKey={(p) => p.employeeId}
              empty={t("timeclock.today.emptyPresent")}
              columns={[
                {
                  key: "name",
                  header: t("timeclock.today.columns.employee"),
                  priority: "primary",
                  cell: nameCell,
                },
                {
                  key: "department",
                  header: t("timeclock.today.columns.department"),
                  cell: departmentCell,
                },
                {
                  key: "in",
                  header: t("timeclock.logs.columns.arrivee"),
                  cell: (p) => <span className="tabular-nums">{time(p.firstIn)}</span>,
                },
                {
                  key: "out",
                  header: t("timeclock.logs.columns.depart"),
                  cell: (p) => <span className="tabular-nums">{time(p.lastOut)}</span>,
                },
                {
                  key: "status",
                  header: t("timeclock.logs.columns.statut"),
                  priority: "actions",
                  cell: (p) =>
                    p.anomaly ? (
                      <Badge variant="destructive">{t(`timeclock.anomaly.${p.anomaly}`)}</Badge>
                    ) : p.isComplete ? (
                      <Badge variant="secondary">{t("timeclock.today.left")}</Badge>
                    ) : (
                      <Badge>{t("timeclock.today.onSite")}</Badge>
                    ),
                },
              ]}
            />
          ) : (
            <ResponsiveTable<TodayPerson>
              data={(group === "absent" ? data?.absent : data?.onLeave) ?? []}
              getRowKey={(p) => p.employeeId}
              empty={t(
                group === "absent" ? "timeclock.today.emptyAbsent" : "timeclock.today.emptyOnLeave",
              )}
              columns={[
                {
                  key: "name",
                  header: t("timeclock.today.columns.employee"),
                  priority: "primary",
                  cell: nameCell,
                },
                {
                  key: "department",
                  header: t("timeclock.today.columns.department"),
                  cell: departmentCell,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
