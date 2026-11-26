// Timeclock: work zones, badge scans and attendance — 06-api-reference §6 (module `timeclock`).
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const ATTENDANCE_PAGE_SIZE = 50;

export type LatLng = { lat: number; lng: number };

export interface WorkZone {
  id: string;
  name: string;
  shape: "circle" | "polygon";
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  /** Closed GeoJSON exterior ring: `[longitude, latitude]` pairs. */
  polygon: [number, number][] | null;
  isActive: boolean;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ZoneInput =
  | { name: string; shape: "circle"; center: LatLng; radiusMeters: number }
  | { name: string; shape: "polygon"; points: LatLng[] };

export type PunchType = "in" | "out";
export type PunchSource = "nfc" | "kiosk" | "manual" | "mobile_gps";

/** Response of `POST /org/timeclock/scan`. */
export interface Punch {
  id: string;
  employee: { id: string; fullName: string; photoUrl: string | null; jobTitle: string | null };
  type: PunchType;
  punchedAt: string;
  source: PunchSource;
  workZone: { id: string; name: string } | null;
  isWithinZone: boolean | null;
  distanceMeters: number | null;
  anomaly: string | null;
}

export type AttendanceAnomaly = "missing_out" | "out_of_zone" | "duplicate" | "late";
export const ATTENDANCE_ANOMALIES: AttendanceAnomaly[] = [
  "missing_out",
  "duplicate",
  "late",
  "out_of_zone",
];

/** One employee's day, aggregated by the API from the punches. */
export interface AttendanceDay {
  employeeId: string;
  day: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  punchCount: number;
  isComplete: boolean;
  /**
   * Minutes between the start of the day's first slot and the first `in` (0 when on
   * time); `null` without a schedule slot, on a holiday or without `in`.
   */
  lateMinutes: number | null;
  anomaly: AttendanceAnomaly | null;
}

export interface AttendanceFilters {
  page: number;
  /** Local dates `YYYY-MM-DD`, at most 93 days apart (API: last 30 days by default). */
  from?: string;
  to?: string;
  employeeId?: string;
  anomaly?: AttendanceAnomaly;
}

export const timeclockKey = (organizationId: string) =>
  ["org", organizationId, "timeclock"] as const;

/** Converts the API ring to map points, without the closing point. */
export function ringToPoints(ring: [number, number][] | null): LatLng[] | null {
  if (!ring) return null;
  const points = ring.map(([lng, lat]) => ({ lat, lng }));
  const [first, last] = [points[0], points[points.length - 1]];
  if (points.length > 1 && first.lat === last.lat && first.lng === last.lng) points.pop();
  return points;
}

/** Converts map points to a closed `[longitude, latitude]` ring. */
export function pointsToRing(points: LatLng[]): [number, number][] {
  const ring = points.map((p): [number, number] => [p.lng, p.lat]);
  return [...ring, ring[0]];
}

export const zonesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...timeclockKey(organizationId), "zones"],
    queryFn: () => api.get<WorkZone[]>("/org/timeclock/zones"),
  });

export function createZone(input: ZoneInput) {
  const body =
    input.shape === "circle"
      ? {
          name: input.name,
          shape: "circle",
          latitude: input.center.lat,
          longitude: input.center.lng,
          radiusMeters: input.radiusMeters,
        }
      : { name: input.name, shape: "polygon", polygon: pointsToRing(input.points) };
  return api.post<WorkZone>("/org/timeclock/zones", body);
}

/** Soft delete: the punches that reference the zone keep it. */
export function deleteZone(id: string) {
  return api.delete(`/org/timeclock/zones/${encodeURIComponent(id)}`);
}

export interface ScanInput {
  badgeUid: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  /** Same id for a retry: the API then returns the existing punch. */
  clientPunchId: string;
}

export function scanBadge(input: ScanInput) {
  return api.post<Punch>("/org/timeclock/scan", input, { idempotencyKey: input.clientPunchId });
}

export const attendanceQuery = (organizationId: string, filters: AttendanceFilters) =>
  queryOptions({
    queryKey: [...timeclockKey(organizationId), "attendance", filters],
    queryFn: () =>
      api.list<AttendanceDay>("/org/timeclock/attendance", {
        page: filters.page,
        perPage: ATTENDANCE_PAGE_SIZE,
        "filter[from]": filters.from,
        "filter[to]": filters.to,
        "filter[employeeId]": filters.employeeId,
        "filter[anomaly]": filters.anomaly,
      }),
    placeholderData: keepPreviousData,
  });

// ---------------------------------------------------------------------------
// Work schedules — 06 §6 « Horaires de travail ». Read by O H M S, written by O H.
// ---------------------------------------------------------------------------

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export const MAX_SLOTS_PER_DAY = 4;

/** `HH:MM`. A slot whose end is not after its start ends the next day (night shift). */
export interface ScheduleSlot {
  start: string;
  end: string;
}

export type WeeklyPattern = Record<WeekDay, ScheduleSlot[]>;

export interface WorkSchedule {
  id: string;
  name: string;
  isDefault: boolean;
  /** Set for an employee's own schedule, which can never be the default. */
  employeeId: string | null;
  weeklyPattern: WeeklyPattern;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  name: string;
  isDefault: boolean;
  weeklyPattern: WeeklyPattern;
  employeeId: string | null;
}

export const isNightSlot = (slot: ScheduleSlot) => slot.end <= slot.start;

export const schedulesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...timeclockKey(organizationId), "schedules"],
    queryFn: () => api.get<WorkSchedule[]>("/org/timeclock/schedules"),
  });

/**
 * `422` rules `scheduleOverlap` (weeklyPattern), `scheduleDefaultEmployee`; `409` rules
 * `scheduleName`, `scheduleEmployee` (one own schedule per employee).
 */
export function createSchedule(input: ScheduleInput) {
  return api.post<WorkSchedule>("/org/timeclock/schedules", input);
}

export function updateSchedule(id: string, input: ScheduleInput) {
  return api.patch<WorkSchedule>(`/org/timeclock/schedules/${encodeURIComponent(id)}`, input);
}

/** `409` rule `scheduleDefault`: the default schedule cannot be deleted. */
export function deleteSchedule(id: string) {
  return api.delete(`/org/timeclock/schedules/${encodeURIComponent(id)}`);
}

/** Minutes of delay tolerated before the `late` anomaly (`settings.timeclock`). */
export const DEFAULT_LATE_TOLERANCE = 10;
export const MAX_LATE_TOLERANCE = 120;

export function lateTolerance(settings: Record<string, unknown> | undefined): number {
  const timeclock = (settings?.timeclock ?? {}) as { lateToleranceMinutes?: unknown };
  return typeof timeclock.lateToleranceMinutes === "number"
    ? timeclock.lateToleranceMinutes
    : DEFAULT_LATE_TOLERANCE;
}
