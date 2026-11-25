// Bloc de suivi du paiement Djomy, réutilisé avant et après la création du
// compte (page publique /paiement, retour carte, inscription, abonnement).
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Clock, Copy, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { gnf, type PlanCode } from "@/components/billing/checkout-shared";
import { usePaymentClaimStatus, type ClaimSummary } from "@/hooks/usePaymentClaimStatus";

type Tone = "pending" | "success" | "error";

function useStatusMeta() {
  const { t } = useTranslation();
  const STATUS_META: Record<string, { label: string; tone: Tone; help: string }> = {
    pending: {
      label: t("paymentTracker.statusPending"),
      tone: "pending",
      help: t("paymentTracker.helpPending"),
    },
    success: {
      label: t("paymentTracker.statusSuccess"),
      tone: "success",
      help: t("paymentTracker.helpSuccess"),
    },
    failed: {
      label: t("paymentTracker.statusFailed"),
      tone: "error",
      help: t("paymentTracker.helpFailed"),
    },
    cancelled: {
      label: t("paymentTracker.statusCancelled"),
      tone: "error",
      help: t("paymentTracker.helpCancelled"),
    },
    mismatch: {
      label: t("paymentTracker.statusMismatch"),
      tone: "error",
      help: t("paymentTracker.helpMismatch"),
    },
  };
  return (status: string) =>
    STATUS_META[status] ?? {
      label: status,
      tone: "pending" as Tone,
      help: t("paymentTracker.helpGeneric"),
    };
}

function StatusBadge({ status, claimed }: { status: string; claimed: boolean }) {
  const { t } = useTranslation();
  const statusMeta = useStatusMeta();
  if (claimed) return <Badge variant="success">{t("paymentTracker.claimedBadge")}</Badge>;
  const { label, tone } = statusMeta(status);
  if (tone === "success") return <Badge variant="success">{label}</Badge>;
  if (tone === "error") return <Badge variant="destructive">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

function Steps({ status, claimed }: { status: string; claimed: boolean }) {
  const { t } = useTranslation();
  const statusMeta = useStatusMeta();
  const paid = status === "success";
  const failed = statusMeta(status).tone === "error";
  const steps = [
    { label: t("paymentTracker.stepInitiated"), done: true, failed: false },
    { label: t("paymentTracker.stepConfirmed"), done: paid, failed },
    { label: t("paymentTracker.stepAttached"), done: claimed, failed: false },
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
            className={`text-xs font-medium ${
              s.done ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {i + 1}. {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CopyToken({ token }: { token: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(token)
          .then(() => {
            setCopied(true);
            toast.success(t("paymentTracker.codeCopied"));
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => toast.error(t("paymentTracker.copyError")));
      }}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary"
    >
      <span className="truncate">{token}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}

export interface PaymentStatusTrackerProps {
  claimToken: string;
  /** Version condensée (inscription, encart d'abonnement). */
  compact?: boolean;
  /** Masque les actions contextuelles (créer un compte, réessayer…). */
  hideActions?: boolean;
  /** Action supplémentaire rendue à côté des actions par défaut. */
  extraActions?: React.ReactNode;
  /** Notifié à chaque mise à jour du résumé. */
  onStatus?: (summary: ClaimSummary | null) => void;
}

export function PaymentStatusTracker({
  claimToken,
  compact = false,
  hideActions = false,
  extraActions,
  onStatus,
}: PaymentStatusTrackerProps) {
  const { t } = useTranslation();
  const statusMeta = useStatusMeta();
  const { summary, loading, error, elapsed, stalled, refreshNow } =
    usePaymentClaimStatus(claimToken);

  useEffect(() => {
    onStatus?.(summary);
  }, [summary, onStatus]);

  if (!summary) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("paymentTracker.loading")}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              {error ?? t("paymentTracker.noPayment")}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const meta = statusMeta(summary.status);
  const paid = summary.status === "success";
  const failed = meta.tone === "error";

  return (
    <Card>
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
          <StatusBadge status={summary.status} claimed={summary.claimed} />
        </div>

        {!compact && <Steps status={summary.status} claimed={summary.claimed} />}

        <p className="text-sm text-muted-foreground">
          {summary.claimed ? t("paymentTracker.helpClaimed") : meta.help}
        </p>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.offerLabel")}</dt>
            <dd className="font-medium text-foreground">
              {summary.planName ?? "—"} — {summary.cycle}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.amountLabel")}</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {gnf(summary.amount)} {summary.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.emailLabel")}</dt>
            <dd className="font-medium text-foreground">{summary.emailMasked}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("paymentTracker.trackingCodeLabel")}</dt>
            <dd>
              <CopyToken token={claimToken} />
            </dd>
          </div>
        </dl>

        {!summary.claimed && !paid && !failed && (
          <p className="text-xs text-muted-foreground">
            {stalled
              ? t("paymentTracker.stalledHint")
              : t("paymentTracker.waitingSince", { count: elapsed })}
          </p>
        )}

        {!hideActions && (
          <div className="flex flex-wrap gap-2">
            {!summary.claimed && !paid && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshNow()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("paymentTracker.refresh")}
              </Button>
            )}
            {paid && !summary.claimed && (
              <Button asChild size="sm">
                <Link to="/signup" search={{ claim: claimToken }}>
                  {t("paymentTracker.createAccount")}
                </Link>
              </Button>
            )}
            {failed && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/paiement"
                  search={{
                    plan: (summary.planCode as PlanCode) ?? "starter",
                    cycle: summary.cycle === "annuel" ? "annuel" : "mensuel",
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
