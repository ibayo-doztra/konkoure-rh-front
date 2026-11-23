// Performance cycles, plans and goals — 06-api-reference §9 (module `performance`).
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type PlanStatus = "draft" | "active" | "closed";
export type GoalCategory = "business" | "development" | "behavioral";
export type GoalStatus = "not_started" | "in_progress" | "achieved" | "late" | "cancelled";

/** Statuses a client may set: `achieved` follows the progress, `late` the nightly job (07 §5.2). */
export const WRITABLE_GOAL_STATUSES = ["not_started", "in_progress", "cancelled"] as const;
export type WritableGoalStatus = (typeof WRITABLE_GOAL_STATUSES)[number];

export const GOAL_STATUS_VARIANT: Record<
  GoalStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  not_started: "outline",
  in_progress: "secondary",
  late: "destructive",
  achieved: "success",
  cancelled: "outline",
};

export interface PerformancePlan {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  /** The holder: the employee the goal belongs to and who is evaluated on it. */
  employeeId: string;
  ownerId: string | null;
  planId: string | null;
  reviewId: string | null;
  parentGoalId: string | null;
  title: string;
  description: string | null;
  measurement: string | null;
  category: GoalCategory;
  weight: number;
  progress: number;
  status: GoalStatus;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  /** Defaults to the caller's record; another employee needs O H or the holder's manager. */
  employeeId?: string;
  description?: string | null;
  measurement?: string | null;
  category?: GoalCategory;
  weight?: number;
  startDate?: string | null;
  dueDate?: string | null;
  planId?: string | null;
}

export const ACTIVITY_STATUSES = ["planned", "in_progress", "done"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface GoalActivity {
  id: string;
  goalId: string;
  employeeId: string | null;
  title: string;
  description: string | null;
  status: ActivityStatus;
  plannedDate: string | null;
  /** Set when the status becomes `done`, cleared when it leaves it. */
  completedAt: string | null;
  createdAt: string;
}

export interface ActivityInput {
  title: string;
  description?: string | null;
  status?: ActivityStatus;
  plannedDate?: string | null;
}

export type GoalUpdate = Partial<Omit<GoalInput, "employeeId">> & { status?: WritableGoalStatus };

/** Every performance query of an organization, to refresh them together after a change. */
export const performanceKey = (organizationId: string) =>
  ["org", organizationId, "performance"] as const;

/** Plans are few: the whole list, every status. */
export const plansQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "plans"],
    queryFn: () => api.all<PerformancePlan>("/org/performance/plans"),
  });

/** Goals the reader may see: self, team (manager) or everyone (owner, hr_admin). */
export const goalsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "goals"],
    queryFn: () => api.all<Goal>("/org/performance/goals"),
  });

/** Activities of every goal the reader may see, across goals. */
export const activitiesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "activities"],
    queryFn: () => api.all<GoalActivity>("/org/performance/activities"),
  });

const goalPath = (id: string) => `/org/performance/goals/${encodeURIComponent(id)}`;

export function createGoal(input: GoalInput) {
  return api.post<Goal>("/org/performance/goals", input);
}

export function updateGoal(id: string, input: GoalUpdate) {
  return api.patch<Goal>(goalPath(id), input);
}

/** 0 to 100; 100 marks the goal `achieved`. */
export function updateGoalProgress(id: string, progress: number) {
  return api.patch<Goal>(`${goalPath(id)}/progress`, { progress });
}

export function deleteGoal(id: string) {
  return api.delete(goalPath(id));
}

const activityPath = (goalId: string, id: string) =>
  `${goalPath(goalId)}/activities/${encodeURIComponent(id)}`;

export function createActivity(goalId: string, input: ActivityInput) {
  return api.post<GoalActivity>(`${goalPath(goalId)}/activities`, input);
}

export function updateActivity(goalId: string, id: string, input: Partial<ActivityInput>) {
  return api.patch<GoalActivity>(activityPath(goalId, id), input);
}

export function deleteActivity(goalId: string, id: string) {
  return api.delete(activityPath(goalId, id));
}
