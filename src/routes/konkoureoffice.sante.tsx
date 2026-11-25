import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import { platformHealthQuery } from "@/lib/api/platform";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/sante")({
  component: AdminHealthPage,
  head: () => ({
    meta: [
      { title: "Santé — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const CHECK_LABELS: Record<string, string> = {
  database: "Base de données",
  redis: "Redis (cache)",
  migrations: "Migrations",
};

const INTEGRATION_LABELS: Record<string, string> = {
  djomy: "Djomy (paiements)",
  ai: "Assistant IA",
};

function Probe({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
      )}
      <span className="flex-1 font-medium">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function AdminHealthPage() {
  const health = useQuery(platformHealthQuery());
  const data = health.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Santé de la plateforme"
        description="Base de données, cache, migrations, file de tâches et intégrations"
        actions={
          <Button
            variant="outline"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
        }
      />

      {health.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(health.error)}</p>
      ) : !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-5">
              <Badge variant={data.ready ? "default" : "destructive"} data-testid="health-status">
                {data.ready ? "Opérationnelle" : "Dégradée"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Vérifiée le {formatDateTime(data.checkedAt)} · file de tâches : {data.queue.driver}
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-2 p-5">
                <h2 className="font-semibold">Services</h2>
                {Object.entries(data.checks).map(([key, value]) => (
                  <Probe
                    key={key}
                    label={CHECK_LABELS[key] ?? key}
                    ok={value === "ok"}
                    value={value}
                  />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-5">
                <h2 className="font-semibold">Intégrations</h2>
                {Object.entries(data.integrations).map(([key, value]) => (
                  <Probe
                    key={key}
                    label={INTEGRATION_LABELS[key] ?? key}
                    ok={value === "configured"}
                    value={value === "configured" ? "configurée" : "non configurée"}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
