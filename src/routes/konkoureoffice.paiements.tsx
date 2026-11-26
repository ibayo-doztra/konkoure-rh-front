import { csvCell } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import {
  isRootOnly,
  platformKey,
  platformPaymentsQuery,
  platformPlansQuery,
  reconcilePayment,
  type PlatformPayment,
} from "@/lib/api/platform";
import type { PaymentStatus } from "@/lib/api/billing";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/paiements")({
  component: AdminPaymentsPage,
  head: () => ({
    meta: [
      { title: "Paiements — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const ALL = "all";
const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  succeeded: "Réglé",
  failed: "Échoué",
  expired: "Expiré",
  refunded: "Remboursé",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function statusVariant(s: PaymentStatus) {
  if (s === "succeeded") return "default" as const;
  if (s === "failed" || s === "expired") return "destructive" as const;
  return "secondary" as const;
}

function reconcileError(error: unknown) {
  if (isRootOnly(error)) return "Action réservée aux administrateurs root.";
  if (isApiError(error, "E_CONFLICT")) {
    const rule = error.details[0]?.rule;
    if (rule === "notPaid")
      return "Djomy n'indique pas de paiement complet pour cette transaction.";
    if (rule === "noTransaction") return "Aucune transaction Djomy n'est liée à ce paiement.";
  }
  if (error instanceof Error && isApiError(error) && error.status === 503)
    return "Djomy est indisponible pour le moment.";
  return apiErrorMessage(error);
}

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const { canWrite } = usePlatformAdmin();
  const [status, setStatus] = useState<string>(ALL);
  const [organizationId, setOrganizationId] = useState("");
  const [page, setPage] = useState(1);
  const [toReconcile, setToReconcile] = useState<PlatformPayment | null>(null);

  const orgFilter = UUID.test(organizationId.trim()) ? organizationId.trim() : undefined;
  const payments = useQuery(
    platformPaymentsQuery(page, {
      status: status === ALL ? undefined : (status as PaymentStatus),
      organizationId: orgFilter,
    }),
  );
  const plans = useQuery(platformPlansQuery());
  const planName = (id: string | null) => (id && plans.data?.find((p) => p.id === id)?.name) || "—";
  const rows = payments.data?.data ?? [];
  const lastPage = payments.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const reconcile = useMutation({
    mutationFn: (id: string) => reconcilePayment(id),
    onSuccess: async (result) => {
      setToReconcile(null);
      toast.success(
        result.outcome === "already_settled"
          ? "Ce paiement était déjà réglé."
          : "Paiement rapproché : l'abonnement et la facture suivent.",
      );
      await qc.invalidateQueries({ queryKey: [...platformKey, "payments"] });
    },
    onError: (e) => {
      setToReconcile(null);
      toast.error(reconcileError(e));
    },
  });

  const exportCsv = () => {
    const header = ["Date", "Référence", "Organisation", "Offre", "Cycle", "Montant", "Statut"];
    const lines = rows.map((p) =>
      [
        formatDateTime(p.createdAt),
        p.merchantReference,
        p.organizationId ?? (p.presignup ? "avant inscription" : ""),
        planName(p.planId),
        p.cycle ?? "",
        p.expectedAmount,
        STATUS_LABELS[p.status] ?? p.status,
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paiements.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description="Transactions d'abonnement, y compris les paiements avant inscription"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label="Statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="Identifiant d'organisation"
            aria-label="Filtrer par organisation"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {payments.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(payments.error)}</p>
      ) : payments.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun paiement" hint="Les transactions apparaîtront ici." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={rows}
              getRowKey={(p) => p.id}
              empty="Aucun paiement"
              columns={[
                {
                  key: "ref",
                  header: "Paiement",
                  priority: "primary",
                  cell: (p) => (
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs">{p.merchantReference}</p>
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                        {p.presignup ? " · avant inscription" : ""}
                      </p>
                    </div>
                  ),
                },
                { key: "plan", header: "Offre", cell: (p) => planName(p.planId) },
                {
                  key: "amount",
                  header: "Montant",
                  align: "right",
                  cell: (p) => formatCurrency(p.expectedAmount, p.currency),
                },
                { key: "method", header: "Méthode", cell: (p) => p.method ?? "—" },
                {
                  key: "status",
                  header: "Statut",
                  cell: (p) => (
                    <div className="space-y-1">
                      <Badge variant={statusVariant(p.status)}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      {p.failureReason && (
                        <p className="text-xs text-muted-foreground">{p.failureReason}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  priority: "actions",
                  align: "right",
                  cell: (p) =>
                    canWrite && p.status !== "succeeded" && p.status !== "refunded" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rapprocher ${p.merchantReference}`}
                        onClick={() => setToReconcile(p)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    ) : null,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <ListPager page={page} lastPage={lastPage} onChange={setPage} />

      <ConfirmDialog
        open={!!toReconcile}
        onOpenChange={(open) => !open && setToReconcile(null)}
        title="Rapprocher ce paiement ?"
        subtitle={toReconcile?.merchantReference}
        description="L'état est redemandé à Djomy. S'il est payé en totalité, le paiement est réglé normalement (activation, facture, e-mail), même s'il était échoué ou expiré."
        actionLabel="Rapprocher"
        loading={reconcile.isPending}
        onConfirm={() => toReconcile && reconcile.mutate(toReconcile.id)}
      />
    </div>
  );
}
