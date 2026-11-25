// Organization billing — 06-api-reference §10 (`/org/billing`, owner only).
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const BILLING_PAGE_SIZE = 10;

export type BillingCycle = "monthly" | "yearly";
export type PaymentMethod = "orange_money" | "mtn_momo" | "card";
export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
export type PaymentStatus =
  "pending" | "processing" | "succeeded" | "failed" | "expired" | "refunded";

/** A payment in one of these states will not change any more. */
export const FINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "succeeded",
  "failed",
  "expired",
  "refunded",
];
export const isFinalPayment = (status: PaymentStatus | undefined) =>
  !!status && FINAL_PAYMENT_STATUSES.includes(status);

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceMonthlyGnf: number;
  /** As charged: 10 months when the plan has no yearly price. */
  priceYearlyGnf: number;
  maxEmployees: number;
  aiCreditsPerMonth: number;
  modules: string[];
  features: unknown;
}

export const planPrice = (plan: Plan, cycle: BillingCycle) =>
  cycle === "yearly" ? plan.priceYearlyGnf : plan.priceMonthlyGnf;

export interface PlanRef {
  id: string;
  code: string;
  name: string;
}

export interface Subscription {
  id: string;
  /** Effective status (07 §6.5). */
  status: SubscriptionStatus;
  plan: PlanRef | null;
  cycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  /** A downgrade waiting for the end of the period. */
  scheduledPlan: PlanRef | null;
  scheduledCycle: BillingCycle | null;
}

export interface Usage {
  period: string;
  employees: { used: number; limit: number | null };
  aiCredits: { used: number; limit: number | null };
}

export interface Payment {
  id: string;
  merchantReference: string;
  planId: string | null;
  cycle: BillingCycle | null;
  method: PaymentMethod | "bank_transfer" | "manual" | null;
  status: PaymentStatus;
  expectedAmount: number;
  paidAmount: number | null;
  currency: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  hasPdf: boolean;
}

export const billingKey = (organizationId: string) => ["org", organizationId, "billing"] as const;

export const subscriptionQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "subscription"],
    queryFn: () => api.get<Subscription>("/org/billing/subscription"),
  });

export const plansQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "plans"],
    queryFn: () => api.get<Plan[]>("/org/billing/plans"),
    staleTime: 5 * 60_000,
  });

export const usageQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "usage"],
    queryFn: () => api.get<Usage>("/org/billing/usage"),
  });

export const paymentsQuery = (organizationId: string, page: number) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "payments", page],
    queryFn: () => api.list<Payment>("/org/billing/payments", { page, perPage: BILLING_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

export const invoicesQuery = (organizationId: string, page: number) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "invoices", page],
    queryFn: () => api.list<Invoice>("/org/billing/invoices", { page, perPage: BILLING_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

/** Polled every 3 s, 60 times at most, until the status is final (06 §10). */
export const PAYMENT_POLL_MS = 3000;
export const PAYMENT_POLL_MAX = 60;

export const paymentQuery = (organizationId: string, id: string) =>
  queryOptions({
    queryKey: [...billingKey(organizationId), "payment", id],
    queryFn: () => api.get<Payment>(`/org/billing/payments/${encodeURIComponent(id)}`),
    retry: false,
  });

/** Signed link valid 15 minutes; 409 `notReady` while the PDF is being generated. */
export function invoicePdfUrl(id: string) {
  return api.get<{ url: string; expiresIn: number }>(
    `/org/billing/invoices/${encodeURIComponent(id)}/pdf`,
  );
}

/** Paid plan, `active` or `past_due` (409 `notCancelable`): ends at the term. */
export function cancelSubscription() {
  return api.post<Subscription>("/org/billing/cancel");
}

/** A canceled subscription whose period still runs (409 `notResumable`). */
export function resumeSubscription() {
  return api.post<Subscription>("/org/billing/resume");
}

export interface CheckoutInput {
  planId: string;
  cycle: BillingCycle;
  method: PaymentMethod;
  /** `+224…`, required for Orange Money and MTN MoMo. */
  payerPhone?: string;
}

export interface CheckoutStarted {
  paymentId: string;
  merchantReference: string;
  status: PaymentStatus;
  expectedAmount: number;
  currency: string;
  /** Mobile money: what to do on the phone. */
  instructions: string | null;
  /** Card: the Djomy portal. */
  redirectUrl: string | null;
}

export interface CheckoutScheduled {
  scheduled: true;
  planId: string;
  cycle: BillingCycle;
  effectiveAt: string;
}

export type CheckoutResult = CheckoutStarted | CheckoutScheduled;

export const isScheduled = (r: CheckoutResult): r is CheckoutScheduled =>
  "scheduled" in r && r.scheduled === true;

/**
 * Opens a payment (201), or schedules a downgrade at the term (200). The
 * amount is computed by the server (prorated upgrade). 403 E_QUOTA_EXCEEDED
 * when the headcount exceeds the target plan; 503 when Djomy is unavailable.
 */
export function startCheckout(input: CheckoutInput, idempotencyKey: string) {
  return api.post<CheckoutResult>("/org/billing/checkout", input, { idempotencyKey });
}

/** `622 12 34 56` (or with 224) → `+224622123456`. */
export function toApiPhone(value: string) {
  return `+224${value.replace(/\D/g, "").replace(/^224/, "")}`;
}
