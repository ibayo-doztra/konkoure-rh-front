// Paying before sign-up — 06-api-reference §11 (`/public/plans`, `/public/payments`).
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { MeOrganization } from "@/lib/api/types";
import type { BillingCycle, PaymentMethod, PaymentStatus, Plan } from "@/lib/api/billing";

/** A payment made before sign-up is followed with its reference and its claim code. */
export interface PendingClaim {
  ref: string;
  token: string;
}

/** Paid plans only: the `free` plan is in the catalogue but cannot be bought. */
export const publicPlansQuery = () =>
  queryOptions({
    queryKey: ["public", "plans"],
    queryFn: () => api.get<Plan[]>("/public/plans"),
    select: (plans: Plan[]) => plans.filter((p) => p.priceMonthlyGnf > 0),
    staleTime: 5 * 60_000,
  });

export interface PresignupCheckoutInput {
  planId: string;
  cycle: BillingCycle;
  method: PaymentMethod;
  /** `+224…`, required for Orange Money and MTN MoMo. */
  payerPhone?: string;
  /** The account created later must use this address to claim the payment. */
  email: string;
}

export interface PresignupCheckout {
  merchantReference: string;
  /** `clm_…`, returned only once: it must be kept by the client. */
  claimToken: string;
  claimExpiresAt: string | null;
  status: PaymentStatus;
  expectedAmount: number;
  currency: string;
  instructions: string | null;
  redirectUrl: string | null;
}

/** Full amount, no proration. 503 when Djomy is unavailable. */
export function startPresignupCheckout(input: PresignupCheckoutInput, idempotencyKey: string) {
  return api.post<PresignupCheckout>("/public/payments/checkout", input, { idempotencyKey });
}

export interface PresignupStatus {
  status: PaymentStatus;
  planCode: string;
  cycle: BillingCycle;
  expectedAmount: number;
  currency: string;
  emailMasked: string | null;
  /** Paid, not attached yet and not expired. */
  claimable: boolean;
}

/** 404 without the right claim code. */
export const presignupPaymentQuery = ({ ref, token }: PendingClaim) =>
  queryOptions({
    queryKey: ["public", "payments", ref, token],
    queryFn: () =>
      api.get<PresignupStatus>(`/public/payments/${encodeURIComponent(ref)}`, undefined, {
        headers: { "X-Claim-Token": token },
      }),
    retry: false,
  });

/** Rules of `409 E_CLAIM_INVALID` (`details[0].rule`). */
export type ClaimRule = "notPaid" | "used" | "expired" | "email";

/**
 * Uses the payment for a new organization (`organizationName`, the caller
 * becomes its owner) or for one the caller owns (`organizationId`: 403 when
 * not owner, 404 when not a member). On an existing organization, the same
 * paid plan and cycle extend the period; anything else starts a new one now.
 * Requires a verified e-mail equal to the payment's.
 */
export type ClaimTarget =
  { claimToken: string; organizationName: string } | { claimToken: string; organizationId: string };

export function claimPresignupPayment(ref: string, input: ClaimTarget) {
  return api.post<MeOrganization>(`/public/payments/${encodeURIComponent(ref)}/claim`, input);
}
