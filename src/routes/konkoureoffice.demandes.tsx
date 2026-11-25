import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  DEMO_STATUS_LABELS,
  DEMO_STATUSES,
  demoRequestsQuery,
  platformAdminsQuery,
  platformKey,
  updateDemoRequest,
  type DemoRequest,
  type DemoRequestStatus,
} from "@/lib/api/platform";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const ALL = "all";

function AdminDemoRequestsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { level } = usePlatformAdmin();
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const requests = useQuery(
    demoRequestsQuery(page, status === ALL ? undefined : (status as DemoRequestStatus)),
  );
  // The admins list is root-only: a support admin sees "Moi" or a short id.
  const admins = useQuery({ ...platformAdminsQuery(), enabled: level === "root" });
  const rows = requests.data?.data ?? [];
  const lastPage = requests.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const assigneeName = (id: string | null) => {
    if (!id) return "—";
    if (id === user?.id) return "Moi";
    const admin = admins.data?.find((a) => a.userId === id);
    return admin?.fullName ?? admin?.email ?? `${id.slice(0, 8)}…`;
  };

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof updateDemoRequest>[1]) =>
      updateDemoRequest(id, patch),
    onSuccess: async () => {
      toast.success("Demande mise à jour");
      await qc.invalidateQueries({ queryKey: [...platformKey, "demo-requests"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes de démo"
        description="Suivi commercial et état d'envoi des notifications"
        actions={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filtrer par statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {DEMO_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DEMO_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {requests.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(requests.error)}</p>
      ) : requests.isPending ? (
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
            <ResponsiveTable<DemoRequest>
              data={rows}
              getRowKey={(d) => d.id}
              empty="Aucune demande"
              columns={[
                {
                  key: "requester",
                  header: "Demandeur",
                  priority: "primary",
                  cell: (d) => (
                    <div className="min-w-0">
                      <p className="break-words font-medium">{d.fullName}</p>
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
                      <p className="break-words">{d.companyName}</p>
                      <p className="text-xs text-muted-foreground">{d.companySize}</p>
                    </div>
                  ),
                },
                {
                  key: "contact",
                  header: "Contact",
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
                  cell: (d) => formatDateTime(d.createdAt),
                },
                {
                  key: "email",
                  header: "E-mail",
                  cell: (d) =>
                    d.emailStatus ? (
                      <Badge
                        variant={
                          d.emailStatus === "sent"
                            ? "default"
                            : d.emailStatus === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {d.emailStatus}
                      </Badge>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "assignee",
                  header: "Suivi par",
                  cell: (d) => (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{assigneeName(d.assignedTo)}</span>
                      {d.assignedTo === user?.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => update.mutate({ id: d.id, assignedTo: null })}
                        >
                          Libérer
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => user && update.mutate({ id: d.id, assignedTo: user.id })}
                        >
                          M'assigner
                        </Button>
                      )}
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Statut",
                  headClassName: "w-44",
                  cell: (d) => (
                    <Select
                      value={d.status}
                      onValueChange={(v) =>
                        update.mutate({ id: d.id, status: v as DemoRequestStatus })
                      }
                    >
                      <SelectTrigger
                        className="w-full md:w-44"
                        aria-label={`Statut de la demande de ${d.fullName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {DEMO_STATUS_LABELS[s]}
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

      <ListPager page={page} lastPage={lastPage} onChange={setPage} />
    </div>
  );
}
