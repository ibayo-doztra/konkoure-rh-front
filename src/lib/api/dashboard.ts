// Organization dashboard — 06-api-reference §3 (`GET /org/dashboard`).
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LeaveType } from "@/lib/api/leaves";

export type DashboardPeriod = "week" | "month" | "quarter";

/**
 * Figures of the current week, month or quarter, scoped by the API: the whole
 * organization for owner and hr_admin, the team for a manager, oneself
 * otherwise. A block is `null` when its module is not in the plan (or not
 * delivered yet). The API caches the figures for 5 minutes.
 */
export interface Dashboard {
  period: { from: string; to: string };
  headcount: {
    total: number;
    active: number;
    onLeave: number;
    newHires: number;
    exits: number;
  } | null;
  attendance: {
    punctualityRate: number | null;
    avgWorkedHours: number | null;
    absencesToday: number;
    outOfZonePunches: number;
  } | null;
  leaves: { pending: number; approvedThisPeriod: number; daysTaken: number } | null;
  recruitment: { openJobs: number; newCandidates: number; hired: number } | null;
  performance: {
    reviewsInProgress: number;
    reviewsSigned: number;
    avgGoalProgress: number;
  } | null;
  series: {
    headcountByMonth: { month: string; total: number }[] | null;
    punchesByDay: { day: string; count: number }[] | null;
    leavesByType: { type: LeaveType; days: number }[] | null;
  };
}

export const dashboardQuery = (organizationId: string, period: DashboardPeriod) =>
  queryOptions({
    queryKey: ["org", organizationId, "dashboard", period],
    queryFn: () => api.get<Dashboard>("/org/dashboard", { period }),
  });
