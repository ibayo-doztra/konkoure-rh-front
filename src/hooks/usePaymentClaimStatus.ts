// Suivi en temps réel d'un paiement anticipé à partir de son code de
// rattachement. Le statut fait foi côté serveur (revalidation prestataire).
import { useCallback, useEffect, useRef, useState } from "react";
import { getPrepaidSummary } from "@/lib/api/legacy-functions";

export interface ClaimSummary {
  status: string;
  cycle: string;
  planName: string | null;
  planCode: string | null;
  emailMasked: string;
  claimed: boolean;
  amount: number;
  currency: string;
  method: string | null;
  merchantReference: string;
  createdAt: string | null;
}

const POLL_MS = 3000;
/** Arrêt du rafraîchissement automatique au bout de 3 minutes. */
const MAX_POLLS = 60;

export const isFinalStatus = (status: string | undefined) =>
  !!status && status !== "pending";

export function usePaymentClaimStatus(claimToken: string | null) {
  const fetchSummary = getPrepaidSummary;

  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [loading, setLoading] = useState(!!claimToken);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stalled, setStalled] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(
    async (refresh: boolean): Promise<ClaimSummary | null> => {
      if (!claimToken) return null;
      const res = (await fetchSummary({
        data: { claimToken, refresh },
      })) as ClaimSummary | null;
      return res;
    },
    [claimToken, fetchSummary],
  );

  useEffect(() => {
    cancelled.current = false;
    setSummary(null);
    setError(null);
    setElapsed(0);
    setStalled(false);
    if (!claimToken) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const poll = async (n: number) => {
      try {
        const res = await load(n > 0);
        if (cancelled.current) return;
        setSummary(res);
        setLoading(false);
        if (!res) {
          setError("Aucun paiement ne correspond à ce code.");
          return;
        }
        setElapsed(n * (POLL_MS / 1000));
        if (isFinalStatus(res.status)) return;
        if (n >= MAX_POLLS) {
          setStalled(true);
          return;
        }
        timer.current = setTimeout(() => void poll(n + 1), POLL_MS);
      } catch {
        if (cancelled.current) return;
        setLoading(false);
        if (n >= MAX_POLLS) {
          setStalled(true);
          return;
        }
        timer.current = setTimeout(() => void poll(n + 1), POLL_MS);
      }
    };

    void poll(0);
    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [claimToken, load]);

  /** Vérification manuelle immédiate. */
  const refreshNow = useCallback(async () => {
    if (!claimToken) return;
    setLoading(true);
    try {
      const res = await load(true);
      setSummary(res);
      setError(res ? null : "Aucun paiement ne correspond à ce code.");
      if (res && !isFinalStatus(res.status)) {
        setStalled(true);
      }
    } catch {
      setError("Vérification impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [claimToken, load]);

  return { summary, loading, error, elapsed, stalled, refreshNow };
}
