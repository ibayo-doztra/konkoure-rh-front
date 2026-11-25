// Tracking block of a payment made before sign-up, reused on the public pages
// (/paiement, card return, tracking), on sign-up and on onboarding.
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Clock, Copy, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { gnf, PLAN_CODES, type PlanCode } from "@/components/billing/checkout-shared";
import { usePaymentClaimStatus, type ClaimSummary } from "@/hooks/usePaymentClaimStatus";
import { isFinalPayment, type PaymentStatus } from "@/lib/api/billing";
import type { PendingClaim } from "@/lib/api/billing-public";

type Tone = "pending" | "success" | "error";

const TONES: Record<PaymentStatus, Tone> = {
  pending: "pending",
  processing: "pending",
  succeeded: "success",
  failed: "error",
  expired: "error",
  refunded: "error",
};

/** Link that reopens this tracking page, with the claim code. */
export function trackingUrl(claim: PendingClaim) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const params = new URLSearchParams({ ref: claim.ref, claim: claim.token });
  return `${origin}/paiement/suivi?${params.toString()}`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  const label = t(`paymentTracker.status.${status}`);
  const tone = TONES[status] ?? "pending";
  if (tone === "success") return <Badge variant="success">{label}</Badge>;
  if (tone === "error") return <Badge variant="destructive">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

function Steps({ summary }: { summary: ClaimSummary }) {
  const { t } = useTranslation();
  const paid = summary.status === "succeeded";
  const failed = TONES[summary.status] === "error";
  const steps = [
    { label: t("paymentTracker.stepInitiated"), done: true, failed: false },
    { label: t("paymentTracker.stepConfirmed"), done: paid, failed },
    { label: t("paymentTracker.stepAccount"), done: false, failed: false },
  ];

  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-2 sm:flex-col sm:text-center">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
              s.failed
                ? "border-destructive bg-destructive/10 text-destructive"
                : s.done
                  ? "border-success bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {s.failed ? (
              <XCircle className="h-4 w-4" />
            ) : s.done ? (
              <Check className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
          </span>
          <span
            className={`text-xs font-medium ${s.done ? "text-foreground" : "text-muted-foreground"}`}
          >
            {i + 1}. {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CopyTrackingLink({ claim }: { claim: PendingClaim }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(trackingUrl(claim))
          .then(() => {
            setCopied(true);
            toast.success(t("paymentTracker.linkCopied"));
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => toast.error(t("paymentTracker.copyError")));
      }}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary"
    >
      <span className="truncate">{claim.token}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}

export interface PaymentStatusTrackerProps {
  claim: PendingClaim;
  /** Condensed version (sign-up, onboarding). */
  compact?: boolean;
  /** Hides the contextual actions (create an account, retry…). */
  hideActions?: boolean;
  /** Extra action rendered next to the default ones. */
  extraActions?: React.ReactNode;
  /** Called on every update of the summary. */
  onStatus?: (summary: ClaimSummary | null) => void;
}

export function PaymentStatusTracker({
  claim,
  compact = false,
  hideActions = false,
  extraActions,
  onStatus,
}: PaymentStatusTrackerProps) {
  const { t } = useTranslation();
  const { summary, loading, refreshing, error, elapsed, stalled, refreshNow } =
    usePaymentClaimStatus(claim);

  useEffect(() => {
    onStatus?.(summary);
  }, [summary, onStatus]);

  if (!summary) {
    return (
      <Card>
        <CardContent
          className="flex items-center gap-3 p-6 text-sm text-muted-foreground"
          role="status"
        >
          {loading || !error ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("paymentTracker.loading")}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              {t("paymentTracker.noPayment")}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const tone = TONES[summary.status] ?? "pending";
  const paid = summary.status === "succeeded";
  const failed = tone === "error";
  const help = paid
    ? summary.claimable
      ? t("paymentTracker.help.claimable")
      : t("paymentTracker.help.notClaimable")
    : t(`paymentTracker.help.${summary.status}`);
  const planCode = PLAN_CODES.includes(summary.planCode as PlanCode)
    ? (summary.planCode as PlanCode)
    : "starter";

  return (
    <Card data-testid="payment-tracker">
      <CardContent className={compact ? "space-y-3 p-4" : "space-y-5 p-6"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {paid ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : failed ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <span className="text-sm font-semibold">{t("paymentTracker.title")}</span>
          </div>
          <StatusBadge status={summary.status} />
        </div>

        {!compact && <Steps summary={summary} />}

        <p className="text-sm text-muted-foreground" role="status">
          {help}
        </p>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.offerLabel")}</dt>
            <dd className="font-medium text-foreground">
              {t(`paymentTracker.plans.${planCode}`)} —{" "}
              {summary.cycle === "yearly"
                ? t("paymentTracker.cycleYearly")
                : t("paymentTracker.cycleMonthly")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.amountLabel")}</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {gnf(summary.expectedAmount)} {summary.currency}
            </dd>
          </div>
          {summary.emailMasked && (
            <div>
              <dt className="text-muted-foreground">{t("paymentTracker.emailLabel")}</dt>
              <dd className="font-medium text-foreground">{summary.emailMasked}</dd>
            </div>
          )}
          {!compact && (
            <div>
              <dt className="text-muted-foreground">{t("paymentTracker.trackingCodeLabel")}</dt>
              <dd>
                <CopyTrackingLink claim={claim} />
              </dd>
            </div>
          )}
        </dl>

        {!isFinalPayment(summary.status) && (
          <p className="text-xs text-muted-foreground">
            {stalled
              ? t("paymentTracker.stalledHint")
              : t("paymentTracker.waitingSince", { count: elapsed })}
          </p>
        )}

        {!hideActions && (
          <div className="flex flex-wrap gap-2">
            {!isFinalPayment(summary.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshNow()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("paymentTracker.refresh")}
              </Button>
            )}
            {paid && summary.claimable && (
              <>
                <Button asChild size="sm">
                  <Link to="/signup" search={{ ref: claim.ref, claim: claim.token }}>
                    {t("paymentTracker.createAccount")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/login" search={{}}>
                    {t("paymentTracker.signIn")}
                  </Link>
                </Button>
              </>
            )}
            {failed && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/paiement"
                  search={{
                    plan: planCode,
                    cycle: summary.cycle === "yearly" ? "annuel" : "mensuel",
                  }}
                >
                  {t("paymentTracker.retryPayment")}
                </Link>
              </Button>
            )}
            {extraActions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
