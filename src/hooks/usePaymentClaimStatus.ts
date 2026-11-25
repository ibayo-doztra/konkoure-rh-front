// Follows a payment made before sign-up with its reference and claim code.
// The status is always the one read from the API (checked with Djomy by the
// server), never the one sent back by the provider in the URL.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isFinalPayment, PAYMENT_POLL_MAX, PAYMENT_POLL_MS } from "@/lib/api/billing";
import {
  presignupPaymentQuery,
  type PendingClaim,
  type PresignupStatus,
} from "@/lib/api/billing-public";

export type ClaimSummary = PresignupStatus;

const DISABLED: PendingClaim = { ref: "", token: "" };

export function usePaymentClaimStatus(claim: PendingClaim | null) {
  const query = useQuery({
    ...presignupPaymentQuery(claim ?? DISABLED),
    enabled: !!claim,
    refetchInterval: (q) =>
      isFinalPayment(q.state.data?.status) || q.state.dataUpdateCount >= PAYMENT_POLL_MAX
        ? false
        : PAYMENT_POLL_MS,
  });

  // Seconds spent waiting, shown while the operator has not confirmed yet.
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    setPolls(0);
  }, [claim?.ref, claim?.token]);
  useEffect(() => {
    if (query.dataUpdatedAt) setPolls((n) => n + 1);
  }, [query.dataUpdatedAt]);

  const summary = query.data ?? null;
  const stalled = !!summary && !isFinalPayment(summary.status) && polls >= PAYMENT_POLL_MAX;

  const { refetch } = query;
  const refreshNow = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    summary,
    loading: query.isFetching && !summary,
    refreshing: query.isFetching,
    error: query.error,
    elapsed: Math.max(0, polls - 1) * (PAYMENT_POLL_MS / 1000),
    stalled,
    refreshNow,
  };
}
