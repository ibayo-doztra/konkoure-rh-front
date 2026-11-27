import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import { leaveCalendarQuery, type CalendarLeave, type Holiday } from "@/lib/api/leaves";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/leaves/calendar")({
  component: LeaveCalendarPage,
});

const MAX_CHIPS = 3;
const pad = (n: number) => String(n).padStart(2, "0");
/** Local date `YYYY-MM-DD`, without going through UTC. */
const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

function todayIso() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
}

interface Day {
  date: string;
  day: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  leaves: CalendarLeave[];
  holiday: Holiday | undefined;
}

function isHalf(leave: CalendarLeave, date: string) {
  return (
    (date === leave.startDate && leave.halfDayStart) || (date === leave.endDate && leave.halfDayEnd)
  );
}

/**
 * Who is away each day of the month (06 §7): approved and pending requests and
 * public holidays. The API scopes the requests: everyone for owner and hr_admin,
 * the team and oneself for a manager, oneself otherwise.
 */
function LeaveCalendarPage() {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const from = isoDate(cursor.year, cursor.month, 1);
  const to = isoDate(cursor.year, cursor.month, lastDay);
  const today = todayIso();

  const calendar = useQuery({ ...leaveCalendarQuery(organizationId, from, to), enabled: !!org });

  const days = useMemo<Day[]>(() => {
    const leaves = calendar.data?.leaves ?? [];
    const holidays = calendar.data?.holidays ?? [];
    return Array.from({ length: lastDay }, (_, i) => {
      const date = isoDate(cursor.year, cursor.month, i + 1);
      return {
        date,
        day: i + 1,
        weekday: (new Date(cursor.year, cursor.month, i + 1).getDay() + 6) % 7,
        leaves: leaves
          .filter((l) => l.startDate <= date && date <= l.endDate)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
        holiday: holidays.find((h) => h.date === date),
      };
    });
  }, [calendar.data, cursor, lastDay]);

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    // 2024-01-01 was a Monday.
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }),
  );
  const leadingBlanks = days[0]?.weekday ?? 0;
  const busyDays = days.filter((d) => d.leaves.length > 0 || d.holiday);

  const chip = (leave: CalendarLeave, date: string) => {
    const half = isHalf(leave, date);
    const label = `${leave.employeeName} · ${t(`leaves.types.${leave.type}`)} · ${t(
      leave.status === "approved" ? "leaves.statusApproved" : "leaves.statusPending",
    )}${half ? ` · ${t("leaves.calendar.halfDay")}` : ""}`;
    return (
      <li
        key={leave.id}
        title={label}
        aria-label={label}
        data-status={leave.status}
        className={cn(
          "truncate rounded px-1.5 py-0.5 text-xs",
          leave.status === "approved"
            ? "bg-primary/15 text-foreground"
            : "border border-dashed border-primary/50 text-muted-foreground",
        )}
      >
        {half && <span aria-hidden="true">½ </span>}
        {leave.employeeName}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("leaves.calendar.title")}
        description={t("leaves.calendar.description")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("leaves.calendar.previous")}
            onClick={() => move(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize" aria-live="polite">
            {monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("leaves.calendar.next")}
            onClick={() => move(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor({ year: d.getFullYear(), month: d.getMonth() });
            }}
          >
            {t("leaves.calendar.today")}
          </Button>
        </div>
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-primary/15" aria-hidden="true" />
            {t("leaves.statusApproved")}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border border-dashed border-primary/50"
              aria-hidden="true"
            />
            {t("leaves.statusPending")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-warning/20" aria-hidden="true" />
            {t("leaves.calendar.holiday")}
          </li>
        </ul>
      </div>

      {calendar.isError ? (
        <p className="p-8 text-muted-foreground">{apiErrorMessage(calendar.error)}</p>
      ) : calendar.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Month grid, from md up. */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
                {weekdayLabels.map((label) => (
                  <div key={label} className="p-2 capitalize">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7" data-testid="leave-calendar-grid">
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <div key={`blank-${i}`} className="min-h-28 border-b border-r bg-muted/20" />
                ))}
                {days.map((d) => (
                  <div
                    key={d.date}
                    data-date={d.date}
                    className={cn(
                      "min-h-28 space-y-1 border-b border-r p-1.5",
                      d.weekday >= 5 && "bg-muted/30",
                      d.holiday && "bg-warning/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                          d.date === today && "bg-primary font-semibold text-primary-foreground",
                        )}
                      >
                        {d.day}
                      </span>
                      {d.holiday && (
                        <span className="truncate text-[11px] font-medium text-warning">
                          {d.holiday.name}
                        </span>
                      )}
                    </div>
                    {d.leaves.length > 0 && (
                      <ul className="space-y-0.5">
                        {d.leaves.slice(0, MAX_CHIPS).map((l) => chip(l, d.date))}
                        {d.leaves.length > MAX_CHIPS && (
                          <li
                            className="px-1.5 text-xs text-muted-foreground"
                            title={d.leaves
                              .slice(MAX_CHIPS)
                              .map((l) => l.employeeName)
                              .join(", ")}
                          >
                            {t("leaves.calendar.more", { count: d.leaves.length - MAX_CHIPS })}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Day list on small screens: only the days with an absence or a holiday. */}
          <div className="space-y-3 md:hidden" data-testid="leave-calendar-list">
            {busyDays.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t("leaves.calendar.empty")}
                </CardContent>
              </Card>
            ) : (
              busyDays.map((d) => (
                <Card key={d.date} data-date={d.date}>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm font-medium capitalize">
                      {new Date(cursor.year, cursor.month, d.day).toLocaleDateString(locale, {
                        weekday: "long",
                        day: "numeric",
                      })}
                      {d.holiday && (
                        <span className="ml-2 font-normal text-warning">{d.holiday.name}</span>
                      )}
                    </p>
                    {d.leaves.length > 0 && (
                      <ul className="space-y-1">{d.leaves.map((l) => chip(l, d.date))}</ul>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {busyDays.length === 0 && (
            <p className="hidden text-center text-sm text-muted-foreground md:block">
              {t("leaves.calendar.empty")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
