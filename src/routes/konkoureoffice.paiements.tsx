import { csvCell } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { listAdminPayments } from "@/lib/api/legacy-functions";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function statusVariant(s: string) {
  if (s === "succeeded" || s === "paid") return "default" as const;
  if (s === "failed" || s === "canceled") return "destructive" as const;
  return "secondary" as const;
}

function AdminPaymentsPage() {
  const fn = listAdminPayments;
  const { data, isLoading } = useQuery({ queryKey: ["admin-payments"], queryFn: () => fn() });
  const rows = (data ?? []) as any[];

  const total = rows
    .filter((p) => p.status === "succeeded" || p.status === "paid")
    .reduce((s, p) => s + Number(p.expected_amount ?? 0), 0);

  const exportCsv = () => {
    const header = ["Date", "Organisation", "Offre", "Cycle", "Montant", "Statut", "Méthode", "Transaction"];
    const lines = rows.map((p) =>
      [
        formatDateTime(p.created_at),
        p.organization_name,
        p.plan_name,
        p.cycle,
        p.expected_amount,
        p.status,
        p.method ?? "",
        p.djomy_transaction_id ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
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
        description={`Transactions d'abonnement · encaissé : ${formatCurrency(total)}`}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        }
      />

      {isLoading ? (
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
                  key: "date",
                  header: "Date",
                  className: "text-sm",
                  cell: (p) => formatDateTime(p.created_at),
                },
                {
                  key: "org",
                  header: "Organisation",
                  priority: "primary",
                  cell: (p) => (
                    <div className="min-w-0">
                      <p className="break-words">{p.organization_name}</p>
                      {p.claim_email && (
                        <p className="break-words text-xs font-normal text-muted-foreground">
                          {p.claim_email}
                        </p>
                      )}
                    </div>
                  ),
                },
                { key: "plan", header: "Offre", cell: (p) => p.plan_name },
                { key: "cycle", header: "Cycle", cell: (p) => p.cycle },
                {
                  key: "amount",
                  header: "Montant",
                  align: "right",
                  cell: (p) => formatCurrency(Number(p.expected_amount), p.currency ?? "GNF"),
                },
                { key: "method", header: "Méthode", cell: (p) => p.method ?? "—" },
                {
                  key: "status",
                  header: "Statut",
                  cell: (p) => <Badge variant={statusVariant(String(p.status))}>{p.status}</Badge>,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
