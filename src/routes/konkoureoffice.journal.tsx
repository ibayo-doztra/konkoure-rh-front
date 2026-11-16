import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getAdminUsageStats, listAdminLogs } from "@/lib/api/legacy-functions";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/journal")({
  component: AdminLogsPage,
  head: () => ({
    meta: [
      { title: "Journal & usage — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Kind = "audit" | "usage" | "system";

function AdminLogsPage() {
  const logsFn = listAdminLogs;
  const statsFn = getAdminUsageStats;

  const [kind, setKind] = useState<Kind>("audit");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");

  const logsQ = useQuery({
    queryKey: ["admin-logs", kind, days, search],
    queryFn: () =>
      logsFn({ data: { kind, days: Number(days), search: search || undefined, limit: 200 } as any }),
  });
  const statsQ = useQuery({
    queryKey: ["admin-usage-stats", days],
    queryFn: () => statsFn({ data: { days: Number(days) } }),
  });

  const rows = (logsQ.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader title="Journal & usage" description="Traçabilité des actions sensibles et statistiques d'utilisation" />

      {statsQ.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Événements d'usage</p>
              <p className="text-xl font-semibold">{statsQ.data.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs text-muted-foreground">Modules les plus utilisés</p>
              <div className="flex flex-wrap gap-1">
                {statsQ.data.byModule.slice(0, 6).map((m: any) => (
                  <Badge key={m.module} variant="secondary" className="text-[10px]">
                    {m.module} · {m.count}
                  </Badge>
                ))}
                {statsQ.data.byModule.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs text-muted-foreground">Organisations les plus actives</p>
              <div className="flex flex-wrap gap-1">
                {statsQ.data.byOrganization.slice(0, 5).map((o: any) => (
                  <Badge key={o.id} variant="outline" className="text-[10px]">
                    {o.name} · {o.count}
                  </Badge>
                ))}
                {statsQ.data.byOrganization.length === 0 && (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <TabsList>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="system">Système</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="pl-9"
            />
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {logsQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun événement" hint="Ajustez la période ou le filtre." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={rows}
              getRowKey={(r) => String(r.id)}
              empty="Aucune entrée"
              columns={[
                {
                  key: "date",
                  header: "Date",
                  className: "whitespace-nowrap text-sm",
                  cell: (r) => (
                    <span className="whitespace-nowrap text-sm">{formatDateTime(r.created_at)}</span>
                  ),
                },
                {
                  key: "actor",
                  header: kind === "system" ? "Niveau" : "Acteur",
                  className: "text-sm",
                  cell: (r) =>
                    kind === "system" ? (
                      <Badge variant={r.level === "error" ? "destructive" : "secondary"}>{r.level}</Badge>
                    ) : (
                      (r.actor_email ?? r.user_id ?? "—")
                    ),
                },
                {
                  key: "action",
                  header: kind === "audit" ? "Action" : kind === "usage" ? "Événement" : "Message",
                  priority: "primary",
                  className: "text-sm font-medium",
                  cell: (r) => (
                    <span className="break-words">
                      {kind === "audit" ? r.action : kind === "usage" ? r.kind : r.message}
                    </span>
                  ),
                },
                {
                  key: "detail",
                  header: "Détail",
                  className: "max-w-md truncate text-xs text-muted-foreground",
                  cell: (r) => (
                    <span className="break-words text-xs text-muted-foreground">
                      {kind === "audit"
                        ? `${r.target_type ?? ""} ${r.target_id ?? ""}`.trim() || "—"
                        : kind === "usage"
                          ? (r.module ?? "—")
                          : JSON.stringify(r.context ?? {})}
                    </span>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
