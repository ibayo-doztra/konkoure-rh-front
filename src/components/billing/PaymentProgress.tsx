// Follows a subscription payment until its status is final. The status shown is
// always the one read from the API (confirmed by the Djomy webhook and a server
// check), never the one sent back by the provider in the URL.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  billingKey,
  isFinalPayment,
  PAYMENT_POLL_MAX,
  PAYMENT_POLL_MS,
  paymentQuery,
} from "@/lib/api/billing";
import { apiErrorMessage } from "@/lib/api/client";
import { useOrg } from "@/hooks/useOrg";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { gnf } from "@/components/billing/checkout-shared";

export function PaymentProgress({
  paymentId,
  instructions,
  onRetry,
}: {
  paymentId: string;
  /** Mobile money instructions from the checkout response. */
  instructions?: string | null;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { refetch: reloadSession } = useSubscription();
  const payment = useQuery({
    ...paymentQuery(organizationId, paymentId),
    enabled: !!org && !!paymentId,
    refetchInterval: (query) =>
      isFinalPayment(query.state.data?.status) || query.state.dataUpdateCount >= PAYMENT_POLL_MAX
        ? false
        : PAYMENT_POLL_MS,
  });
  const status = payment.data?.status;
  const success = status === "succeeded";
  const failed = isFinalPayment(status) && !success;
  // Number of answers received: polling stops after PAYMENT_POLL_MAX of them.
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    if (payment.dataUpdatedAt) setPolls((n) => n + 1);
  }, [payment.dataUpdatedAt]);
  const stalled = !isFinalPayment(status) && polls >= PAYMENT_POLL_MAX;

  // Once paid, the subscription and the modules of the session change.
  const refreshed = useRef(false);
  useEffect(() => {
    if (!success || refreshed.current) return;
    refreshed.current = true;
    void queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
    void reloadSession?.();
  }, [success, organizationId, queryClient, reloadSession]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center" role="status">
        {success ? (
          <CheckCircle2 className="h-10 w-10 text-success" />
        ) : failed || payment.isError ? (
          <XCircle className="h-10 w-10 text-destructive" />
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        )}
        <h1 className="text-xl font-bold">
          {payment.isError
            ? t("checkout.statusUnknown")
            : success
              ? t("checkout.statusConfirmed")
              : failed
                ? t("checkout.statusFailed")
                : t("checkout.statusWaiting")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {payment.isError
            ? apiErrorMessage(payment.error)
            : success
              ? t("checkout.resultConfirmed")
              : failed
                ? t(`checkout.failure.${status}`, { defaultValue: t("checkout.resultFailed") })
                : (instructions ?? t("checkout.resultPendingGeneric"))}
        </p>
        {payment.data && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("checkout.paymentReference", {
              reference: payment.data.merchantReference,
              amount: gnf(payment.data.expectedAmount),
            })}
          </p>
        )}
        {stalled && <p className="text-xs text-muted-foreground">{t("checkout.stalled")}</p>}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {!success && !failed && (
            <Button
              variant="outline"
              onClick={() => void payment.refetch()}
              disabled={payment.isFetching}
            >
              {t("checkout.iPaidCheck")}
            </Button>
          )}
          {(failed || payment.isError) && onRetry && (
            <Button variant="outline" onClick={onRetry}>
              {t("checkout.retry")}
            </Button>
          )}
          <Button asChild variant={success ? "default" : "ghost"}>
            <Link to="/app/billing">{t("checkout.returnToBilling")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
