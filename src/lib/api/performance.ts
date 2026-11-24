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

export type CycleFrequency = "annual" | "semestrial" | "quarterly" | "custom";
export type CycleStatus = "draft" | "open" | "closed";

export interface PerformanceCycle {
  id: string;
  name: string;
  frequency: CycleFrequency;
  periodStart: string;
  periodEnd: string;
  selfEvalOpensAt: string | null;
  selfEvalClosesAt: string | null;
  status: CycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CycleInput {
  name: string;
  frequency: CycleFrequency;
  periodStart: string;
  periodEnd: string;
  selfEvalOpensAt?: string | null;
  selfEvalClosesAt?: string | null;
}

export interface PlanInput {
  name: string;
  periodStart: string;
  periodEnd: string;
  status?: PlanStatus;
}

export const cyclesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "cycles"],
    queryFn: () => api.all<PerformanceCycle>("/org/performance/cycles"),
  });

const cyclePath = (id: string) => `/org/performance/cycles/${encodeURIComponent(id)}`;
const planPath = (id: string) => `/org/performance/plans/${encodeURIComponent(id)}`;

/** Created in `draft`. */
export function createCycle(input: CycleInput) {
  return api.post<PerformanceCycle>("/org/performance/cycles", input);
}

/** `draft → open`; `409` from any other state. */
export function openCycle(id: string) {
  return api.post<PerformanceCycle>(`${cyclePath(id)}/open`);
}

/** `open → closed`. */
export function closeCycle(id: string) {
  return api.post<PerformanceCycle>(`${cyclePath(id)}/close`);
}

export function createPlan(input: PlanInput) {
  return api.post<PerformancePlan>("/org/performance/plans", input);
}

/** Activating re-checks every employee's weights (`422 E_WEIGHT_OVERFLOW`). */
export function updatePlan(id: string, input: Partial<PlanInput>) {
  return api.patch<PerformancePlan>(planPath(id), input);
}

/** Soft delete: goals keep their `planId`. */
export function deletePlan(id: string) {
  return api.delete(planPath(id));
}

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

// ------------------------------------------------------------------ OKR (07 §5.3)

export type OkrStatus = "draft" | "active" | "completed" | "archived";
export type OkrReviewStatus = "draft" | "pending" | "validated" | "needs_revision";

export interface KeyResult {
  id: string;
  position: number;
  title: string;
  metric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  isDone: boolean;
  doneAt: string | null;
}

export interface Okr {
  id: string;
  employeeId: string;
  /** `YYYY-Qn`. */
  quarter: string;
  objective: string;
  status: OkrStatus;
  reviewStatus: OkrReviewStatus;
  /** Share of done key results, kept by the API. */
  progress: number;
  submittedAt: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  managerComment: string | null;
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface KeyResultInput {
  title: string;
  metric?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  isDone?: boolean;
}

export interface OkrCheckin {
  id: string;
  okrId: string;
  authorEmployeeId: string | null;
  message: string;
  progressSnapshot: number;
  createdAt: string;
}

export const QUARTER_PATTERN = /^\d{4}-Q[1-4]$/;

/** The quarter of a date, as the API writes it (`2026-Q4`). */
export function quarterOf(date: Date) {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

/** Objective and key results can change only before validation (07 §5.3). */
export const isOkrEditable = (okr: Okr) =>
  okr.reviewStatus === "draft" || okr.reviewStatus === "needs_revision";

/** Check-ins are accepted on a validated, active OKR only. */
export const acceptsCheckins = (okr: Okr) =>
  okr.reviewStatus === "validated" && okr.status === "active";

const okrPath = (id: string) => `/org/performance/okrs/${encodeURIComponent(id)}`;

export const okrsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "okrs"],
    queryFn: () => api.all<Okr>("/org/performance/okrs"),
  });

export const okrCheckinsQuery = (organizationId: string, okrId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "okrs", okrId, "checkins"],
    queryFn: () => api.get<OkrCheckin[]>(`${okrPath(okrId)}/checkins`),
  });

/** Created in `draft`, without key results: `replaceKeyResults` adds them. */
export function createOkr(input: { quarter: string; objective: string; employeeId?: string }) {
  return api.post<Okr>("/org/performance/okrs", input);
}

/** Replaces the whole list (20 at most). */
export function replaceKeyResults(okrId: string, keyResults: KeyResultInput[]) {
  return api.put<Okr>(`${okrPath(okrId)}/key-results`, { keyResults });
}

export function updateKeyResult(
  okrId: string,
  krId: string,
  input: { isDone?: boolean; currentValue?: number | null },
) {
  return api.patch<Okr>(`${okrPath(okrId)}/key-results/${encodeURIComponent(krId)}`, input);
}

export function submitOkr(id: string) {
  return api.post<Okr>(`${okrPath(id)}/submit`);
}

export function validateOkr(id: string, comment?: string) {
  return api.post<Okr>(`${okrPath(id)}/validate`, comment ? { comment } : {});
}

/** The comment is mandatory. */
export function requestOkrRevision(id: string, comment: string) {
  return api.post<Okr>(`${okrPath(id)}/request-revision`, { comment });
}

export function deleteOkr(id: string) {
  return api.delete(okrPath(id));
}

export function createOkrCheckin(okrId: string, message: string) {
  return api.post<OkrCheckin>(`${okrPath(okrId)}/checkins`, { message });
}

// ------------------------------------------------------------ Evaluations (07 §5.7)

export type ReviewStatus =
  "not_started" | "in_progress" | "submitted" | "sent_back" | "validated" | "signed";

export interface ReviewSummary {
  id: string;
  cycleId: string | null;
  planId: string | null;
  employeeId: string;
  managerId: string | null;
  status: ReviewStatus;
  submittedAt: string | null;
  validatedAt: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReviewGoal = Goal & {
  selfComment: string | null;
  selfRating: number | null;
  /** Null for the evaluated employee until sent back, validated or signed. */
  managerComment: string | null;
  managerRating: number | null;
};

export interface Review extends ReviewSummary {
  selfScore: number | null;
  selfGlobalComment: string | null;
  managerScore: number | null;
  managerGlobalComment: string | null;
  managerSubmittedAt: string | null;
  sentBackAt: string | null;
  sentBackComment: string | null;
  validatedBy: string | null;
  signedBy: string | null;
  goals: ReviewGoal[];
  /** HR talent scores (module `talents`), outside the signed content; null for the evaluated employee. */
  performanceScore?: number | null;
  potentialScore?: number | null;
}

export interface GoalComment {
  goalId: string;
  comment?: string | null;
  rating?: number | null;
}

/** Badge classes of a review status (semantic tokens). */
export const REVIEW_STATUS_CLASS: Record<ReviewStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  sent_back: "bg-destructive/10 text-destructive",
  submitted: "bg-success/10 text-success-foreground",
  validated: "bg-success/15 text-success-foreground",
  signed: "bg-success/15 text-success-foreground",
};

/** Self assessment is editable in these states. */
export const SELF_EDITABLE: readonly ReviewStatus[] = ["not_started", "in_progress", "sent_back"];

const reviewPath = (id: string) => `/org/performance/reviews/${encodeURIComponent(id)}`;

export const reviewsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "reviews"],
    queryFn: () => api.all<ReviewSummary>("/org/performance/reviews"),
  });

export const reviewQuery = (organizationId: string, id: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "reviews", id],
    queryFn: () => api.get<Review>(reviewPath(id)),
    retry: false,
  });

/** HR open one evaluation per present employee of an open cycle; existing ones are skipped. */
export function openReviews(
  input: { cycleId: string; planId?: string; employeeIds?: string[] },
  idempotencyKey: string,
) {
  return api.post<{ created: string[]; skipped: number }>("/org/performance/reviews", input, {
    idempotencyKey,
  });
}

export function saveSelfReview(
  id: string,
  input: { selfScore?: number | null; selfGlobalComment?: string | null; goals?: GoalComment[] },
) {
  return api.patch<Review>(`${reviewPath(id)}/self`, input);
}

export function submitSelfReview(id: string) {
  return api.post<Review>(`${reviewPath(id)}/submit-self`);
}

export function saveManagerReview(
  id: string,
  input: {
    managerScore?: number | null;
    managerGlobalComment?: string | null;
    goals?: GoalComment[];
  },
) {
  return api.patch<Review>(`${reviewPath(id)}/manager`, input);
}

/** Needs `managerScore` and `managerGlobalComment` (`422` otherwise). */
export function validateReview(id: string) {
  return api.post<Review>(`${reviewPath(id)}/validate`);
}

/** The comment is mandatory. */
export function sendBackReview(id: string, comment: string) {
  return api.post<Review>(`${reviewPath(id)}/send-back`, { comment });
}

export function signReview(id: string) {
  return api.post<Review>(`${reviewPath(id)}/sign`);
}

/**
 * 9-box scores (owner, hr_admin, module `talents`), on a validated or signed
 * evaluation only (409 otherwise), never on one's own. `null` clears a score.
 */
export function saveTalentScores(
  id: string,
  input: { performanceScore?: number | null; potentialScore?: number | null },
) {
  return api.patch<Review>(`${reviewPath(id)}/talent`, input);
}

// ------------------------------------------------- Feedback and achievements (07 §5.9)

export const FEEDBACK_KINDS = ["kudos", "suggestion", "concern"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export interface Feedback {
  id: string;
  /** Null on a private feedback, except for HR and the author. */
  fromEmployeeId: string | null;
  toEmployeeId: string;
  kind: FeedbackKind;
  message: string;
  okrId: string | null;
  goalId: string | null;
  isPrivate: boolean;
  visibleToManager: boolean;
  createdAt: string;
}

export interface FeedbackInput {
  toEmployeeId: string;
  kind: FeedbackKind;
  message: string;
  okrId?: string;
  goalId?: string;
  isPrivate?: boolean;
  visibleToManager?: boolean;
}

export interface Achievement {
  id: string;
  employeeId: string;
  goalId: string | null;
  title: string;
  description: string | null;
  impact: string | null;
  achievedAt: string;
  /** User account of the author. */
  createdBy: string | null;
  createdAt: string;
}

export interface AchievementInput {
  title: string;
  achievedAt: string;
  employeeId?: string;
  goalId?: string;
  description?: string;
  impact?: string;
}

/** Received and sent, the team's for a manager, everything for HR. */
export const feedbackQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "feedback"],
    queryFn: () => api.all<Feedback>("/org/performance/feedback"),
  });

export const achievementsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...performanceKey(organizationId), "achievements"],
    queryFn: () => api.all<Achievement>("/org/performance/achievements"),
  });

export function createFeedback(input: FeedbackInput) {
  return api.post<Feedback>("/org/performance/feedback", input);
}

/** The author or HR, never the recipient. */
export function deleteFeedback(id: string) {
  return api.delete(`/org/performance/feedback/${encodeURIComponent(id)}`);
}

export function createAchievement(input: AchievementInput) {
  return api.post<Achievement>("/org/performance/achievements", input);
}

/** The author or HR. */
export function deleteAchievement(id: string) {
  return api.delete(`/org/performance/achievements/${encodeURIComponent(id)}`);
}
