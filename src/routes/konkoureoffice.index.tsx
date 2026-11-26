import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, TrendingDown, Users } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import {
  platformDashboardQuery,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
} from "@/lib/api/platform";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/konkoureoffice/")({
  component: AdminOverviewPage,
  head: () => ({
    meta: [
      { title: "Vue d'ensemble — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOverviewPage() {
  const dashboard = useQuery(platformDashboardQuery());
  const data = dashboard.data;

  if (dashboard.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vue d'ensemble" description="État global de la plateforme" />
        <p className="text-sm text-destructive">{apiErrorMessage(dashboard.error)}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vue d'ensemble" description="État global de la plateforme" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vue d'ensemble" description="État global de la plateforme" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Building2}
          label="Organisations actives"
          value={String(data.organizations.live)}
          hint={`${data.organizations.paying} sur une offre payante`}
        />
        <Kpi
          icon={CreditCard}
          label="Revenu mensuel récurrent"
          value={formatCurrency(data.mrrGnf)}
          hint="Abonnements annuels ramenés au mois"
        />
        <Kpi
          icon={TrendingDown}
          label="Résiliations (30 j)"
          value={String(data.churn30d)}
          hint="Offres payantes arrivées à échéance"
        />
        <Kpi icon={Users} label="En essai" value={String(data.subscriptions.trialing ?? 0)} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Abonnements par statut</h2>
          <div className="flex flex-wrap gap-2" data-testid="subscriptions-by-status">
            {SUBSCRIPTION_STATUSES.map((status) => (
              <Badge key={status} variant="secondary" className="text-xs">
                {SUBSCRIPTION_STATUS_LABELS[status]} · {data.subscriptions[status] ?? 0}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-sm">
            <Link to="/konkoureoffice/organisations" className="text-primary hover:underline">
              Gérer les organisations
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/konkoureoffice/offres" className="text-primary hover:underline">
              Modifier les offres
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/konkoureoffice/journal" className="text-primary hover:underline">
              Consulter le journal
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
