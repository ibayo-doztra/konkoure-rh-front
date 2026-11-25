// Platform back office — 06-api-reference §13 (`/platform`). Access: an active
// platform admin; `support` reads, `root` writes (403 otherwise). The API
// decides: the browser only hides what it cannot do.
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api/client";
import type {
  BillingCycle,
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
