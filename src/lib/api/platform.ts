// Platform back office — 06-api-reference §13 (`/platform`). Access: an active
// platform admin; `support` reads, `root` writes (403 otherwise). The API
// decides: the browser only hides what it cannot do.
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api/client";
import type {
  BillingCycle,
  PaymentStatus,
  Plan,
  Subscription,
  SubscriptionStatus,
  Usage,
} from "@/lib/api/billing";
import type { ModuleKey } from "@/lib/entitlements";
import type { AppRole } from "@/lib/permissions";
import type { PlatformLevel } from "@/lib/api/types";

export const PLATFORM_PAGE_SIZE = 25;

export const platformKey = ["platform"] as const;

/** A write refused because the admin is `support`, not `root`. */
export const isRootOnly = (error: unknown) => isApiError(error, "E_FORBIDDEN");

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
  "expired",
];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Essai",
  active: "Actif",
  past_due: "Impayé",
  suspended: "Suspendu",
  canceled: "Résilié",
  expired: "Expiré",
};

// ------------------------------------------------------------------ Dashboard

export interface PlatformDashboard {
  organizations: { live: number; paying: number };
  /** Effective statuses. */
  subscriptions: Record<SubscriptionStatus, number>;
  /** Paid subscriptions in progress, yearly ones divided by 12. */
  mrrGnf: number;
  /** Paid plans whose access ended in the last 30 days. */
  churn30d: number;
}

export const platformDashboardQuery = () =>
  queryOptions({
    queryKey: [...platformKey, "dashboard"],
    queryFn: () => api.get<PlatformDashboard>("/platform/dashboard"),
  });

// ------------------------------------------------------------------ Organizations

export interface PlatformOrganizationRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  /** Set on deleted organizations (`filter[deleted]=true`), restorable for 30 days. */
  deletedAt: string | null;
  employees: number;
  subscription: {
    /** Stored status of the current subscription. */
    status: SubscriptionStatus;
    cycle: BillingCycle;
    planCode: string | null;
    planName: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

export interface OrganizationFilters {
  q?: string;
  status?: SubscriptionStatus;
  plan?: string;
  /** Lists deleted organizations not yet purged instead of the live ones. */
  deleted?: boolean;
}

export const platformOrganizationsQuery = (page: number, filters: OrganizationFilters) =>
  queryOptions({
    queryKey: [...platformKey, "organizations", page, filters],
    queryFn: () =>
      api.list<PlatformOrganizationRow>("/platform/organizations", {
        page,
        perPage: PLATFORM_PAGE_SIZE,
        q: filters.q,
        "filter[status]": filters.status,
        "filter[plan]": filters.plan,
        "filter[deleted]": filters.deleted ? "true" : undefined,
      }),
    placeholderData: keepPreviousData,
  });

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  defaultLanguage: string;
  createdAt: string;
  deletedAt: string | null;
  /** Set once the 30-day window is over: the organization is anonymized for good. */
  purgedAt: string | null;
  subscription:
    | (Subscription & {
        storedStatus: SubscriptionStatus;
        maxEmployeesOverride: number | null;
        modulesOverride: ModuleKey[] | null;
      })
    | null;
  usage: Usage | null;
  counts: { members: number; employees: number };
  owners: { id: string; email: string; fullName: string | null }[];
}

const organizationPath = (id: string) => `/platform/organizations/${encodeURIComponent(id)}`;

export const platformOrganizationQuery = (id: string) =>
  queryOptions({
    queryKey: [...platformKey, "organization", id],
    queryFn: () => api.get<PlatformOrganization>(organizationPath(id)),
  });

export interface SubscriptionPatch {
  planId?: string;
  status?: SubscriptionStatus;
  cycle?: BillingCycle;
  /** ISO 8601. */
  currentPeriodEnd?: string;
  trialEndsAt?: string | null;
  maxEmployeesOverride?: number | null;
  modulesOverride?: ModuleKey[] | null;
}

/** Root. Invalidates the organization's entitlements cache. */
export function updateOrganizationSubscription(id: string, patch: SubscriptionPatch) {
  return api.patch<PlatformOrganization>(`${organizationPath(id)}/subscription`, patch);
}

/** Root. 409 when already suspended or expired; `hr` becomes read-only. */
export function suspendOrganization(id: string) {
  return api.post<PlatformOrganization>(`${organizationPath(id)}/suspend`);
}

/** Root. From `suspended` only; the status is recomputed from the term (409 otherwise). */
export function reactivateOrganization(id: string) {
  return api.post<PlatformOrganization>(`${organizationPath(id)}/reactivate`);
}

/** Days during which a deleted organization can be restored before it is purged. */
export const RESTORE_WINDOW_DAYS = 30;

/**
 * Root. Cancels a `DELETE /org` within the restore window. 409 with
 * `rule = "notDeleted"` (still live) or `rule = "purged"` (window over).
 */
export function restoreOrganization(id: string) {
  return api.post<PlatformOrganization>(`${organizationPath(id)}/restore`);
}

// ------------------------------------------------------------------ Plans

export interface PlatformPlan extends Plan {
  priceGnf: number;
  /** `null`: the yearly price is 10 months. */
  explicitYearlyPriceGnf: number | null;
  sortOrder: number;
  isPublic: boolean;
  deletedAt: string | null;
}

/** All plans, deleted ones included. */
export const platformPlansQuery = () =>
  queryOptions({
    queryKey: [...platformKey, "plans"],
    queryFn: () => api.get<PlatformPlan[]>("/platform/plans"),
  });

export interface PlanInput {
  name: string;
  priceGnf: number;
  priceYearlyGnf?: number | null;
  maxEmployees: number;
  aiCreditsPerMonth?: number;
  modules: ModuleKey[];
  features?: string[];
  sortOrder?: number;
  isPublic?: boolean;
}

/** Root. `code`: a-z then a-z, 0-9, `-`, `_` (2 to 40), unique (409), never changed. */
export function createPlan(input: PlanInput & { code: string }) {
  return api.post<PlatformPlan>("/platform/plans", input);
}

export function updatePlan(id: string, input: Partial<PlanInput>) {
  return api.patch<PlatformPlan>(`/platform/plans/${encodeURIComponent(id)}`, input);
}

/** Root. Soft delete; 409 `inUse` while a live subscription uses or schedules it. */
export function deletePlan(id: string) {
  return api.delete(`/platform/plans/${encodeURIComponent(id)}`);
}

// ------------------------------------------------------------------ Accounts

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string | null;
  /** `false`: banned. */
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  platformLevel: PlatformLevel | null;
  organizations: { organizationId: string; organizationName: string; roles: AppRole[] }[];
}

export const platformUsersQuery = (page: number, q: string) =>
  queryOptions({
    queryKey: [...platformKey, "users", page, q],
    queryFn: () =>
      api.list<PlatformUser>("/platform/users", {
        page,
        perPage: PLATFORM_PAGE_SIZE,
        q: q || undefined,
      }),
    placeholderData: keepPreviousData,
  });

const userPath = (id: string) => `/platform/users/${encodeURIComponent(id)}`;

/** Root. Replaces the roles in one organization (empty: removed); 409 `lastOwner`. */
export function updateUserRoles(id: string, organizationId: string, roles: AppRole[]) {
  return api.patch<PlatformUser>(`${userPath(id)}/roles`, { organizationId, roles });
}

/** Root. Revokes every session; 409 `self`, `platformAdmin`, or already banned. */
export function banUser(id: string, reason: string) {
  return api.post<PlatformUser>(`${userPath(id)}/ban`, { reason });
}

/** Root. 409 `notBanned`. */
export function unbanUser(id: string) {
  return api.post<PlatformUser>(`${userPath(id)}/unban`);
}

export interface Impersonation {
  /** 30 minutes, no refresh. */
  accessToken: string;
  expiresIn: number;
  expiresAt: string;
  user: { id: string; email: string; fullName: string | null };
}

/** Root. Audited with the reason; refused on oneself, an admin or a banned account (409). */
export function impersonateUser(id: string, reason: string) {
  return api.post<Impersonation>(`${userPath(id)}/impersonate`, { reason });
}

// ------------------------------------------------------------------ Platform admins

export interface PlatformAdmin {
  userId: string;
  email: string | null;
  fullName: string | null;
  level: PlatformLevel;
  createdAt: string;
}

/** Root only. */
export const platformAdminsQuery = () =>
  queryOptions({
    queryKey: [...platformKey, "admins"],
    queryFn: () => api.get<PlatformAdmin[]>("/platform/admins"),
    retry: false,
  });

/** Root. Grants or changes the level of an existing account (422 if unknown or banned). */
export function grantPlatformAdmin(email: string, level: PlatformLevel) {
  return api.post<PlatformAdmin>("/platform/admins", { email, level });
}

/** Root. The last active root can be neither removed nor demoted (409 `lastRoot`). */
export function revokePlatformAdmin(userId: string) {
  return api.delete(`/platform/admins/${encodeURIComponent(userId)}`);
}

// ------------------------------------------------------------------ Settings

export interface PlatformSetting {
  key: string;
  /** Always `null` for a secret setting. */
  value: unknown;
  isSecret: boolean;
  description: string | null;
  updatedAt: string;
}

export const MODULES_OPEN_FOR_TESTING = "modules_open_for_testing";

export const platformSettingsQuery = () =>
  queryOptions({
    queryKey: [...platformKey, "settings"],
    queryFn: () => api.get<PlatformSetting[]>("/platform/settings"),
  });

/** Root. Known keys only, value validated per key (422). */
export function updatePlatformSettings(settings: { key: string; value: unknown }[]) {
  return api.put<PlatformSetting[]>("/platform/settings", { settings });
}

// ------------------------------------------------------------------ Payments

export interface PlatformPayment {
  id: string;
  organizationId: string | null;
  merchantReference: string;
  providerTransactionId: string | null;
  planId: string | null;
  cycle: BillingCycle | null;
  method: string | null;
  status: PaymentStatus;
  expectedAmount: number;
  paidAmount: number | null;
  currency: string;
  failureReason: string | null;
  /** Paid before sign-up. */
  presignup: boolean;
  claimedAt: string | null;
  createdAt: string;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  failureReason?: string;
  organizationId?: string;
}

export const platformPaymentsQuery = (page: number, filters: PaymentFilters) =>
  queryOptions({
    queryKey: [...platformKey, "payments", page, filters],
    queryFn: () =>
      api.list<PlatformPayment>("/platform/payments", {
        page,
        perPage: PLATFORM_PAGE_SIZE,
        "filter[status]": filters.status,
        "filter[failureReason]": filters.failureReason,
        "filter[organizationId]": filters.organizationId,
      }),
    placeholderData: keepPreviousData,
  });

/**
 * Root. Asks Djomy again; fully paid ⇒ settled normally even if it was
 * failed or expired. 409 `notPaid` / `noTransaction`.
 */
export function reconcilePayment(id: string) {
  return api.post<{ outcome: string; payment: PlatformPayment }>(
    `/platform/payments/${encodeURIComponent(id)}/reconcile`,
  );
}

// ------------------------------------------------------------------ Demo requests

export type DemoRequestStatus = "new" | "contacted" | "scheduled" | "done" | "rejected";

export const DEMO_STATUSES: DemoRequestStatus[] = [
  "new",
  "contacted",
  "scheduled",
  "done",
  "rejected",
];

export const DEMO_STATUS_LABELS: Record<DemoRequestStatus, string> = {
  new: "Nouvelle",
  contacted: "Contactée",
  scheduled: "Démo planifiée",
  done: "Terminée",
  rejected: "Écartée",
};

export interface DemoRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  companySize: string;
  message: string | null;
  status: DemoRequestStatus;
  emailStatus: string | null;
  /** A platform admin. */
  assignedTo: string | null;
  createdAt: string;
}

export const demoRequestsQuery = (page: number, status?: DemoRequestStatus) =>
  queryOptions({
    queryKey: [...platformKey, "demo-requests", page, status ?? null],
    queryFn: () =>
      api.list<DemoRequest>("/platform/demo-requests", {
        page,
        perPage: PLATFORM_PAGE_SIZE,
        "filter[status]": status,
      }),
    placeholderData: keepPreviousData,
  });

/** Support. The assignee must be an active platform admin. */
export function updateDemoRequest(
  id: string,
  patch: { status?: DemoRequestStatus; assignedTo?: string | null },
) {
  return api.patch<DemoRequest>(`/platform/demo-requests/${encodeURIComponent(id)}`, patch);
}

export interface DemoRequestInput {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  companySize: string;
  message?: string;
}

/** Public, 10 per hour and per IP. */
export function submitDemoRequest(input: DemoRequestInput) {
  return api.post<{ id: string; received: true }>("/public/demo-requests", input);
}

// ------------------------------------------------------------------ Journals

export type LogKind = "audit" | "system" | "usage";
export const LOG_PAGE_SIZE = 100;

export interface LogFilters {
  organizationId?: string;
  /** ISO 8601. */
  from?: string;
  to?: string;
  actorUserId?: string;
  action?: string;
  channel?: string;
  level?: string;
  module?: string;
}

/** Rows keep their table columns, in camelCase. */
export type LogRow = Record<string, unknown> & { id: string; createdAt: string };

/** Cursor pagination, 500 rows at most per page (06 §13). */
export function platformLogs(kind: LogKind, filters: LogFilters, cursor?: string) {
  return api.list<LogRow>(`/platform/logs/${kind}`, {
    cursor,
    limit: LOG_PAGE_SIZE,
    "filter[organizationId]": filters.organizationId,
    "filter[from]": filters.from,
    "filter[to]": filters.to,
    ...(kind === "audit"
      ? { "filter[actorUserId]": filters.actorUserId, "filter[action]": filters.action }
      : {}),
    ...(kind === "system"
      ? { "filter[channel]": filters.channel, "filter[level]": filters.level }
      : {}),
    ...(kind === "usage" ? { "filter[module]": filters.module } : {}),
  });
}

// ------------------------------------------------------------------ Health

type Probe = "ok" | "unavailable" | "pending" | string;

export interface PlatformHealth {
  status: "ok" | "unavailable";
  ready: boolean;
  checks: { database: Probe; redis: Probe; migrations: Probe };
  queue: { driver: string };
  integrations: Record<string, "configured" | "missing">;
  checkedAt: string;
}

export const platformHealthQuery = () =>
  queryOptions({
    queryKey: [...platformKey, "health"],
    queryFn: () => api.get<PlatformHealth>("/platform/health"),
    refetchInterval: 30_000,
  });
