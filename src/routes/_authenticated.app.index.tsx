import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useProfile } from "@/hooks/useProfile";
import { Users, UserCheck, Briefcase, UserPlus, Clock, ClipboardCheck, Sparkles, Coins } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const searchSchema = z.object({
  period: fallback(z.string(), "month").default("month"),
});

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Konkouré" }] }),
  validateSearch: zodValidator(searchSchema),
  component: Dashboard,
});

type Period = "week" | "month" | "quarter";

interface Trend {
  label: string;
  direction: "up" | "down" | "neutral";
  compareLabel: string;
}

interface KpiCard {
  key: string;
  label: string;
  value: string | number;
  icon: typeof Users;
  trend: Trend;
  isText?: boolean;
}

interface DashboardData {
  cards: KpiCard[];
  hires: { month: string; n: number }[];
}

function getPeriodRange(period: Period): {
  startCur: Date;
  startPrev: Date;
  endCur: Date;
  compareLabel: string;
} {
  const now = new Date();
  if (period === "week") {
    // ISO week: Monday start
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7;
    const startCur = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    const startPrev = new Date(startCur.getTime() - 7 * 86400_000);
    const endCur = new Date(startCur.getTime() + 7 * 86400_000);
    return { startCur, startPrev, endCur, compareLabel: "dashboard.vsLastWeek" };
  }
  if (period === "quarter") {
    const qIdx = Math.floor(now.getMonth() / 3);
    const startCur = new Date(now.getFullYear(), qIdx * 3, 1);
    const startPrev = new Date(now.getFullYear(), qIdx * 3 - 3, 1);
    const endCur = new Date(now.getFullYear(), qIdx * 3 + 3, 1);
    return { startCur, startPrev, endCur, compareLabel: "dashboard.vsLastQuarter" };
  }
  // month
  const startCur = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endCur = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startCur, startPrev, endCur, compareLabel: "dashboard.vsLastMonth" };
}

function pctTrend(current: number, previous: number, compareLabel: string, neutralOnRise = false, t?: (k: string) => string): Trend {
  if (previous === 0) {
    if (current === 0) return { label: t ? t("dashboard.trendNoData") : "—", direction: "neutral", compareLabel };
    return { label: t ? t("dashboard.trendNew") : "Nouveau", direction: "neutral", compareLabel };
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const abs = Math.abs(rounded);
  const label = `${sign}${abs}%`;
  let direction: Trend["direction"] = "neutral";
  if (rounded > 0) direction = neutralOnRise ? "neutral" : "up";
  else if (rounded < 0) direction = neutralOnRise ? "neutral" : "down";
  return { label, direction, compareLabel };
}

function Dashboard() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { firstName } = useProfile();
  const { period: rawPeriod } = Route.useSearch();
  const navigate = Route.useNavigate();
  const period: Period =
    rawPeriod === "week" || rawPeriod === "quarter" ? rawPeriod : "month";
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!org) return;
    setData(null);
    const fetchAll = async () => {
      const { startCur, startPrev, endCur, compareLabel } = getPeriodRange(period);
      const iso = (d: Date) => d.toISOString();
      const orgId = org.id;

      // KPIs: a single GET /org/dashboard?period= replaces these per-table counts (06 §3).
      const [
        empTotal,
        empPrev,
        onLeaveTotal,
        onLeavePrev,
        jobsPublished,
        jobsCur,
        jobsPrev,
        candsTotal,
        candsCur,
        candsPrev,
        logsCur,
        logsPrev,
        reviewsOpen,
        reviewsCur,
        reviewsPrev,
        skillsTotal,
        skillsCur,
        skillsPrev,
        contractsActive,
        contractsPrevActive,
      ] = await Promise.all([
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/dashboard"),
        pendingQuery("GET /org/contracts"),
        pendingQuery("GET /org/contracts"),
      ]);

      const sumActive = (rows: Array<{ salary: number | null; start_date: string; end_date: string | null }> | null, refDate: Date) => {
        const refIso = refDate.toISOString().slice(0, 10);
        return (rows ?? [])
          .filter((c) => c.start_date <= refIso && (!c.end_date || c.end_date >= refIso))
          .reduce((s, c) => s + (Number(c.salary) || 0), 0);
      };
      const now = new Date();
      const payrollNow = sumActive(contractsActive.data as any, now);
      const payrollPrev = sumActive(
        contractsPrevActive.data as any,
        new Date(startCur.getTime() - 1),
      );

      // hires last 6 months (independent of period filter)
      const months: { month: string; n: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        months.push({ month: d.toLocaleDateString("fr-FR", { month: "short" }), n: 0 });
      }
      const since = new Date(); since.setMonth(since.getMonth() - 6);
      const { data: hireData } = await pendingQuery("GET /org/employees");
      hireData?.forEach((h: any) => {
        if (!h.hire_date) return;
        const d = new Date(h.hire_date);
        const idx = months.findIndex((m) => m.month === d.toLocaleDateString("fr-FR", { month: "short" }));
        if (idx >= 0) months[idx].n++;
      });

      const cards: KpiCard[] = [
        {
          key: "employees",
          label: t("dashboard.totalEmployees"),
          value: empTotal.count ?? 0,
          icon: Users,
          trend: pctTrend(empTotal.count ?? 0, empPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "onLeave",
          label: t("dashboard.onLeave"),
          value: onLeaveTotal.count ?? 0,
          icon: UserCheck,
          trend: pctTrend(onLeaveTotal.count ?? 0, onLeavePrev.count ?? 0, compareLabel, true, t),
        },
        {
          key: "jobs",
          label: t("dashboard.openJobs"),
          value: jobsPublished.count ?? 0,
          icon: Briefcase,
          trend: pctTrend(jobsCur.count ?? 0, jobsPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "candidates",
          label: t("dashboard.candidates"),
          value: candsTotal.count ?? 0,
          icon: UserPlus,
          trend: pctTrend(candsCur.count ?? 0, candsPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "todayLogs",
          label: t("dashboard.todayLogs"),
          value: logsCur.count ?? 0,
          icon: Clock,
          trend: pctTrend(logsCur.count ?? 0, logsPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "reviews",
          label: t("dashboard.upcomingReviews"),
          value: reviewsOpen.count ?? 0,
          icon: ClipboardCheck,
          trend: pctTrend(reviewsCur.count ?? 0, reviewsPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "skills",
          label: t("dashboard.skillsTracked"),
          value: skillsTotal.count ?? 0,
          icon: Sparkles,
          trend: pctTrend(skillsCur.count ?? 0, skillsPrev.count ?? 0, compareLabel, false, t),
        },
        {
          key: "payroll",
          label: t("dashboard.revenue"),
          value: formatCurrency(payrollNow),
          icon: Coins,
          trend: pctTrend(payrollNow, payrollPrev, compareLabel, false, t),
          isText: true,
        },
      ];

      setData({ cards, hires: months });
    };
    void fetchAll();
  }, [org, t, period]);

  const greeting = firstName;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {t("common.welcome")} {greeting}
          </h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.greetingSubtitle")}</p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => {
            if (!v) return;
            navigate({ search: (prev: { period?: string }) => ({ ...prev, period: v }), replace: true });
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data ? data.cards.map((c) => {
          const trendClass =
            c.trend.direction === "up" ? "text-success"
            : c.trend.direction === "down" ? "text-destructive"
            : "text-muted-foreground";
          return (
            <Card key={c.key} className="overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{c.label}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span
                        title={String(c.value)}
                        className="max-w-full truncate text-xl font-semibold tabular-nums sm:text-2xl"
                      >
                        {c.value}
                      </span>
                      <span className={`text-xs ${trendClass}`}>{c.trend.label}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t(c.trend.compareLabel)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 animate-pulse">
                <div className="h-12 w-12 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-6 w-1/2 rounded bg-muted" />
                  <div className="h-2 w-1/3 rounded bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">{t("dashboard.hiresChartTitle")}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.hires ?? []}>
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="n" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">{t("dashboard.welcomeTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.welcomeDesc")}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• {t("dashboard.welcomeStep1")}</li>
              <li>• {t("dashboard.welcomeStep2")}</li>
              <li>• {t("dashboard.welcomeStep3")}</li>
              <li>• {t("dashboard.welcomeStep4")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
