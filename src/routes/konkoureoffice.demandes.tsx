import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAdminDemoRequests, updateAdminDemoRequest } from "@/lib/api/legacy-functions";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/demandes")({
  component: AdminDemoRequestsPage,
  head: () => ({
    meta: [
      { title: "Demandes de démo — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUSES = ["new", "contacted", "qualified", "closed"] as const;

function AdminDemoRequestsPage() {
  const qc = useQueryClient();
  const listFn = listAdminDemoRequests;
  const updateFn = updateAdminDemoRequest;

  const { data, isLoading } = useQuery({ queryKey: ["admin-demos"], queryFn: () => listFn() });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateFn({ data: v as any }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      void qc.invalidateQueries({ queryKey: ["admin-demos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const rows = (data ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes de démo"
        description="Suivi commercial et état d'envoi des notifications"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          hint="Les demandes envoyées depuis le site apparaîtront ici."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={rows}
              getRowKey={(d) => String(d.id)}
              empty="Aucune demande"
              columns={[
                {
                  key: "requester",
                  header: "Demandeur",
                  priority: "primary",
                  cell: (d) => (
                    <div className="min-w-0">
                      <p className="break-words font-medium">{d.full_name}</p>
                      {d.message && (
                        <p className="break-words text-xs font-normal text-muted-foreground md:max-w-xs md:truncate">
                          {d.message}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "company",
                  header: "Entreprise",
                  cell: (d) => (
                    <div className="min-w-0">
                      <p className="break-words">{d.company_name}</p>
                      <p className="text-xs text-muted-foreground">{d.company_size}</p>
                    </div>
                  ),
                },
                {
                  key: "contact",
                  header: "Contact",
                  className: "text-sm",
                  cell: (d) => (
                    <div className="min-w-0 text-sm">
                      <p className="break-words">{d.email}</p>
                      <p className="text-muted-foreground">{d.phone}</p>
                    </div>
                  ),
                },
                {
                  key: "created",
                  header: "Reçue le",
                  className: "text-sm",
                  cell: (d) => formatDateTime(d.created_at),
                },
                {
                  key: "email_status",
                  header: "E-mail",
                  cell: (d) => (
                    <Badge
                      variant={
                        d.email_status === "sent"
                          ? "default"
                          : d.email_status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {d.email_status}
                    </Badge>
                  ),
                },
                {
                  key: "status",
                  header: "Statut",
                  headClassName: "w-44",
                  cell: (d) => (
                    <Select
                      value={d.status}
                      onValueChange={(v) => update.mutate({ id: d.id, status: v })}
                    >
                      <SelectTrigger className="w-full md:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
