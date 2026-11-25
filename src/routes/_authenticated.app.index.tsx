import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock,
  LogIn,
  LogOut,
  MapPinOff,
  PenLine,
  Target,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dashboardQuery, type Dashboard, type DashboardPeriod } from "@/lib/api/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOrg } from "@/hooks/useOrg";
import { useProfile } from "@/hooks/useProfile";

const searchSchema = z.object({
  period: z.string().default("month").catch("month"),
});

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Konkouré" }] }),
  validateSearch: searchSchema,
  component: DashboardPage,
});

interface Tile {
  key: string;
  label: string;
  value: string;
  icon: typeof Users;
}

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
};

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const { firstName } = useProfile();
  const { period: rawPeriod } = Route.useSearch();
  const navigate = Route.useNavigate();
  const period: DashboardPeriod =
    rawPeriod === "week" || rawPeriod === "quarter" ? rawPeriod : "month";
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";

  const dashboard = useQuery({ ...dashboardQuery(org?.id ?? "", period), enabled: !!org });
  const data = dashboard.data;

  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale);
  const sections = data ? buildSections(data, t, number) : null;

  const headcount = (data?.series.headcountByMonth ?? []).map((p) => ({
    label: new Date(`${p.month}-01T00:00:00`).toLocaleDateString(locale, { month: "short" }),
    value: p.total,
  }));
  const punches = (data?.series.punchesByDay ?? []).map((p) => ({
    label: new Date(`${p.day}T00:00:00`).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
    }),
    value: p.count,
  }));
  const leavesByType = [...(data?.series.leavesByType ?? [])].sort((a, b) => b.days - a.days);
  const maxLeaveDays = Math.max(1, ...leavesByType.map((l) => l.days));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {t("common.welcome")} {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? t("dashboard.periodRange", {
                  from: date(data.period.from),
                  to: date(data.period.to),
                })
              : t("dashboard.greetingSubtitle")}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => {
            if (!v) return;
            void navigate({
              search: (prev: { period?: string }) => ({ ...prev, period: v }),
              replace: true,
            });
          }}
          variant="outline"
          size="sm"
          aria-label={t("dashboard.periodFilterLabel")}
        >
          <ToggleGroupItem value="week">{t("dashboard.periodWeek")}</ToggleGroupItem>
          <ToggleGroupItem value="month">{t("dashboard.periodMonth")}</ToggleGroupItem>
          <ToggleGroupItem value="quarter">{t("dashboard.periodQuarter")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {dashboard.isError && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {t("dashboard.loadError")}
          </CardContent>
        </Card>
      )}

      {sections ? (
        sections.map((section) => (
          <section key={section.key} className="space-y-3" aria-labelledby={`kpi-${section.key}`}>
            <h2 id={`kpi-${section.key}`} className="text-sm font-medium text-muted-foreground">
              {section.title}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.tiles.map((tile) => (
                <Card key={tile.key} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                        <tile.icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-muted-foreground">{tile.label}</p>
                        <p
                          className="mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl"
                          data-testid={`kpi-${tile.key}`}
                        >
                          {tile.value}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      ) : !dashboard.isError ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex animate-pulse items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-6 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          {data.series.headcountByMonth && (
            <ChartCard
              className="lg:col-span-2"
              title={t("dashboard.headcountChartTitle")}
              data={headcount}
              empty={t("dashboard.noData")}
            />
          )}
          {data.series.leavesByType && (
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold">{t("dashboard.leavesByTypeTitle")}</h3>
                {leavesByType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboard.noData")}</p>
                ) : (
                  <ul className="space-y-3">
                    {leavesByType.map((l) => (
                      <li key={l.type} className="space-y-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <span>{t(`leaves.types.${l.type}`)}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {t("leaves.daysUnit", { count: l.days })}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${(l.days / maxLeaveDays) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          {data.series.punchesByDay && (
            <ChartCard
              className="lg:col-span-3"
              title={t("dashboard.punchesChartTitle")}
              data={punches}
              empty={t("dashboard.noData")}
            />
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("dashboard.cacheHint")}</p>
    </div>
  );
}

/** A single series: one hue, no legend (the title names it), tooltip on hover. */
function ChartCard({
  title,
  data,
  empty,
  className,
}: {
  title: string;
  data: { label: string; value: number }[];
  empty: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h3 className="mb-4 font-semibold">{title}</h3>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap={2}>
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [value, title]}
                />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildSections(
  data: Dashboard,
  t: (key: string, options?: Record<string, unknown>) => string,
  number: (n: number) => string,
) {
  const sections: { key: string; title: string; tiles: Tile[] }[] = [];
  const { headcount, attendance, leaves, recruitment, performance } = data;

  if (headcount) {
    sections.push({
      key: "headcount",
      title: t("dashboard.sectionHeadcount"),
      tiles: [
        {
          key: "employees",
          label: t("dashboard.totalEmployees"),
          value: number(headcount.total),
          icon: Users,
        },
        {
          key: "onLeave",
          label: t("dashboard.onLeave"),
          value: number(headcount.onLeave),
          icon: UserCheck,
        },
        {
          key: "newHires",
          label: t("dashboard.newHires"),
          value: number(headcount.newHires),
          icon: UserPlus,
        },
        {
          key: "exits",
          label: t("dashboard.exits"),
          value: number(headcount.exits),
          icon: UserMinus,
        },
      ],
    });
  }
  if (attendance) {
    sections.push({
      key: "attendance",
      title: t("dashboard.sectionAttendance"),
      tiles: [
        {
          key: "absencesToday",
          label: t("dashboard.absencesToday"),
          value: number(attendance.absencesToday),
          icon: LogOut,
        },
        {
          key: "avgWorkedHours",
          label: t("dashboard.avgWorkedHours"),
          value:
            attendance.avgWorkedHours === null
              ? "—"
              : t("dashboard.hoursValue", { value: attendance.avgWorkedHours.toFixed(1) }),
          icon: Clock,
        },
        {
          key: "outOfZone",
          label: t("dashboard.outOfZonePunches"),
          value: number(attendance.outOfZonePunches),
          icon: MapPinOff,
        },
        ...(attendance.punctualityRate === null
          ? []
          : [
              {
                key: "punctuality",
                label: t("dashboard.punctualityRate"),
                value: `${Math.round(attendance.punctualityRate * 100)} %`,
                icon: LogIn,
              },
            ]),
      ],
    });
  }
  if (leaves) {
    sections.push({
      key: "leaves",
      title: t("dashboard.sectionLeaves"),
      tiles: [
        {
          key: "leavesPending",
          label: t("dashboard.leavesPending"),
          value: number(leaves.pending),
          icon: CalendarClock,
        },
        {
          key: "leavesApproved",
          label: t("dashboard.leavesApproved"),
          value: number(leaves.approvedThisPeriod),
          icon: CalendarCheck,
        },
        {
          key: "daysTaken",
          label: t("dashboard.daysTaken"),
          value: number(leaves.daysTaken),
          icon: CalendarDays,
        },
      ],
    });
  }
  if (recruitment) {
    sections.push({
      key: "recruitment",
      title: t("dashboard.sectionRecruitment"),
      tiles: [
        {
          key: "openJobs",
          label: t("dashboard.openJobs"),
          value: number(recruitment.openJobs),
          icon: Briefcase,
        },
        {
          key: "newCandidates",
          label: t("dashboard.newCandidates"),
          value: number(recruitment.newCandidates),
          icon: UserPlus,
        },
        {
          key: "hired",
          label: t("dashboard.hired"),
          value: number(recruitment.hired),
          icon: UserCheck,
        },
      ],
    });
  }
  if (performance) {
    sections.push({
      key: "performance",
      title: t("dashboard.sectionPerformance"),
      tiles: [
        {
          key: "reviewsInProgress",
          label: t("dashboard.reviewsInProgress"),
          value: number(performance.reviewsInProgress),
          icon: ClipboardCheck,
        },
        {
          key: "reviewsSigned",
          label: t("dashboard.reviewsSigned"),
          value: number(performance.reviewsSigned),
          icon: PenLine,
        },
        {
          key: "avgGoalProgress",
          label: t("dashboard.avgGoalProgress"),
          value:
            performance.avgGoalProgress === null
              ? "—"
              : `${Math.round(performance.avgGoalProgress)} %`,
          icon: Target,
        },
      ],
    });
  }
  return sections;
}
