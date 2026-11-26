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
    /** Null while the organization has no goal. */
    avgGoalProgress: number | null;
  } | null;
  /**
   * Sum of the salaries of today's active contracts, in the organization's currency.
   * Sensitive: filled for owner and hr_admin only, `null` for every other role.
   */
  payroll: { total: number; currency: string } | null;
  /** Same blocks for the previous equivalent period, without series. */
  previous: PreviousDashboard;
  series: {
    headcountByMonth: { month: string; total: number }[] | null;
    punchesByDay: { day: string; count: number }[] | null;
    leavesByType: { type: LeaveType; days: number }[] | null;
  };
}

/**
 * Previous period. Point-in-time figures are not historized and are `null`
 * (`headcount.active`, `onLeave`, `absencesToday`, `punctualityRate`,
 * `leaves.pending`, `openJobs`, `reviewsInProgress`, `avgGoalProgress`): no
 * variation is shown for them. `headcount.total` is the headcount on the last day.
 */
export interface PreviousDashboard {
  period: { from: string; to: string };
  headcount: {
    total: number;
    active: null;
    onLeave: null;
    newHires: number;
    exits: number;
  } | null;
  attendance: {
    punctualityRate: null;
    avgWorkedHours: number | null;
    absencesToday: null;
    outOfZonePunches: number;
  } | null;
  leaves: { pending: null; approvedThisPeriod: number; daysTaken: number } | null;
  recruitment: { openJobs: null; newCandidates: number; hired: number } | null;
  performance: { reviewsInProgress: null; reviewsSigned: number; avgGoalProgress: null } | null;
  payroll: { total: number; currency: string } | null;
}

export const dashboardQuery = (organizationId: string, period: DashboardPeriod) =>
  queryOptions({
    queryKey: ["org", organizationId, "dashboard", period],
    queryFn: () => api.get<Dashboard>("/org/dashboard", { period }),
  });
