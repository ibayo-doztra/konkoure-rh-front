import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, MessageSquare, Users, Activity, ScrollText } from "lucide-react";
import { getAdminOverview } from "@/lib/api/legacy-functions";
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
  const fn = getAdminOverview;
  const { data, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vue d'ensemble" description="État global de la plateforme" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
          label="Organisations"
          value={String(data.organizations)}
          hint={`${data.activeOrganizations} actives · ${data.newOrganizations30} ce mois`}
        />
        <Kpi icon={Users} label="Employés gérés" value={String(data.employees)} />
        <Kpi
          icon={CreditCard}
          label="Encaissé (30 j)"
          value={formatCurrency(data.revenue30)}
        />
        <Kpi icon={MessageSquare} label="Demandes de démo à traiter" value={String(data.pendingDemos)} />
        <Kpi icon={ScrollText} label="Événements d'audit (7 j)" value={String(data.auditEvents7)} />
        <Kpi icon={Activity} label="Événements d'usage (7 j)" value={String(data.usageEvents7)} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Répartition par offre</h2>
          <div className="flex flex-wrap gap-2">
            {data.planDistribution.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune organisation.</p>
            )}
            {data.planDistribution.map((p: any) => (
              <Badge key={p.code} variant="secondary" className="text-xs">
                {p.code} · {p.count}
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
