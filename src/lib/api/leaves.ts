// Leave requests, balances and public holidays — 06-api-reference §7 (module `leaves`).
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { SignedUrl } from "@/lib/api/hr";

export const LEAVES_PAGE_SIZE = 20;

export const LEAVE_TYPES = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "unpaid",
  "special",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Types debited from a balance (API `BALANCE_TYPES`). */
export const BALANCE_TYPES: readonly LeaveType[] = ["annual", "special"];

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  requestedDays: number;
  reason: string | null;
  decisionComment: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  hasAttachment: boolean;
  createdAt: string;
  updatedAt: string;
  /** Detail and mutations only. */
  approverId?: string | null;
  balanceAfter?: number | null;
}

/** A request with the name of its employee, as listed on screen. */
export type LeaveRow = LeaveRequest & { employeeName: string; jobTitle: string | null };

export const LEAVE_STATUS_VARIANT: Record<
  LeaveStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  pending: "secondary",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

export interface LeaveInput {
  /** Owner and hr_admin only; defaults to the reader's own record. */
  employeeId?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  reason?: string;
}

export interface LeaveFilters {
  page: number;
  employeeId?: string;
  status?: LeaveStatus;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  leaveType: LeaveType;
  entitledDays: number;
  carriedOverDays: number;
  takenDays: number;
  pendingDays: number;
  balance: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isMovable: boolean;
  isRecurring: boolean;
}

export interface HolidayInput {
  name: string;
  date: string;
  isMovable?: boolean;
  isRecurring?: boolean;
}

/** Every leave query of an organization, to refresh them together after a change. */
export const leavesKey = (organizationId: string) => ["org", organizationId, "leaves"] as const;

export const leavesQuery = (organizationId: string, filters: LeaveFilters) =>
  queryOptions({
    queryKey: [...leavesKey(organizationId), "requests", filters],
    queryFn: () =>
      api.list<LeaveRequest>("/org/leaves", {
        page: filters.page,
        perPage: LEAVES_PAGE_SIZE,
        "filter[employeeId]": filters.employeeId,
        "filter[status]": filters.status,
      }),
    placeholderData: keepPreviousData,
  });

/** Adds `approverId` and `balanceAfter` (balance of the type once pending days are counted). */
export const leaveQuery = (organizationId: string, id: string) =>
  queryOptions({
    queryKey: [...leavesKey(organizationId), "detail", id],
    queryFn: () => api.get<LeaveRequest>(`/org/leaves/${encodeURIComponent(id)}`),
  });

/** `balance` already deducts approved and pending days. */
export const leaveBalancesQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: [...leavesKey(organizationId), "balances", employeeId],
    queryFn: () => api.get<LeaveBalance[]>("/org/leaves/balances", { employeeId }),
  });

export const holidaysQuery = (organizationId: string, year: number) =>
  queryOptions({
    queryKey: [...leavesKey(organizationId), "holidays", year],
    queryFn: () => api.get<Holiday[]>("/org/holidays", { year }),
  });

const leavePath = (id: string) => `/org/leaves/${encodeURIComponent(id)}`;

export function createLeave(input: LeaveInput, idempotencyKey: string) {
  return api.post<LeaveRequest>("/org/leaves", input, { idempotencyKey });
}

export function approveLeave(id: string) {
  return api.post<LeaveRequest>(`${leavePath(id)}/approve`);
}

/** `decisionComment` is required (5 to 1,000 characters). */
export function rejectLeave(id: string, decisionComment: string) {
  return api.post<LeaveRequest>(`${leavePath(id)}/reject`, { decisionComment });
}

export function cancelLeave(id: string) {
  return api.post<LeaveRequest>(`${leavePath(id)}/cancel`);
}

export function leaveAttachmentUrl(id: string) {
  return api.get<SignedUrl>(`${leavePath(id)}/attachment`);
}

export function uploadLeaveAttachment(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<LeaveRequest>(`${leavePath(id)}/attachment`, form);
}

export function createHoliday(input: HolidayInput) {
  return api.post<Holiday>("/org/holidays", input);
}

export function deleteHoliday(id: string) {
  return api.delete(`/org/holidays/${encodeURIComponent(id)}`);
}

/** Adds the fixed Guinean public holidays of the year that are missing. */
export function importHolidays(year: number) {
  return api.post<Holiday[]>("/org/holidays/import", { year });
}

/**
 * Estimate shown while the request is being filled: weekdays minus public
 * holidays, half days removed. The API computes the authoritative value.
 */
export function estimateLeaveDays(
  start: string,
  end: string,
  holidayDates: Set<string>,
  halfDayStart = false,
  halfDayEnd = false,
): number {
  if (!start || !end || end < start) return 0;
  let days = 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const counted = (d: Date) => {
    const dow = d.getUTCDay();
    return dow !== 0 && dow !== 6 && !holidayDates.has(d.toISOString().slice(0, 10));
  };
  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (counted(cursor)) days += 1;
  }
  // Same rule as the API (07 §3.1): half a day off each counted half-day end.
  if (halfDayStart && counted(new Date(`${start}T00:00:00Z`))) days -= 0.5;
  if (halfDayEnd && counted(last)) days -= 0.5;
  return days;
}

/**
 * `POST /org/leaves/balances/adjust` (O H): adds `deltaDays` (± 365, 2 decimals, not 0)
 * to the entitlement of the year, written to the ledger with `reason` and audited.
 */
export function adjustLeaveBalance(input: {
  employeeId: string;
  leaveType: LeaveType;
  deltaDays: number;
  reason: string;
}) {
  return api.post<LeaveBalance>("/org/leaves/balances/adjust", input);
}
