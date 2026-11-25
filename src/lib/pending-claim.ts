// Keeps the reference and claim code of a payment made BEFORE the account
// existed, to create its organization once the account is ready.
import type { PendingClaim } from "@/lib/api/billing-public";

const KEY = "konkoure.pendingClaim";

export const CLAIM_TOKEN = /^clm_[A-Za-z0-9_-]{6,}$/;
/** Merchant references are UUIDs. */
export const PAYMENT_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isClaim = (value: unknown): value is PendingClaim =>
  !!value &&
  typeof (value as PendingClaim).ref === "string" &&
  (value as PendingClaim).ref.length > 0 &&
  typeof (value as PendingClaim).token === "string" &&
  (value as PendingClaim).token.length > 0;

export function savePendingClaim(claim: PendingClaim) {
  if (typeof window === "undefined") return;
  try {
    const value = JSON.stringify({ ref: claim.ref, token: claim.token });
    sessionStorage.setItem(KEY, value);
    localStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

export function peekPendingClaim(): PendingClaim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isClaim(parsed)) return parsed;
  } catch {
    /* old format (a single UUID) or unreadable value */
  }
  clearPendingClaim();
  return null;
}

/** Reads then forgets the stored claim. */
export function takePendingClaim(): PendingClaim | null {
  const value = peekPendingClaim();
  clearPendingClaim();
  return value;
}

export function clearPendingClaim() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** A claim passed in a tracking link (`?ref=…&claim=…`). */
export function claimFromSearch(search: { ref?: string; claim?: string }): PendingClaim | null {
  return search.ref &&
    search.claim &&
    PAYMENT_REF.test(search.ref) &&
    CLAIM_TOKEN.test(search.claim)
    ? { ref: search.ref, token: search.claim }
    : null;
}
