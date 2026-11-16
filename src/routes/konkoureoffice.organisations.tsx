import { csvCell } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Settings2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminOrganization,
  listAdminOrganizations,
  updateAdminOrganization,
} from "@/lib/api/legacy-functions";
import { listAdminPlans } from "@/lib/api/legacy-functions";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogFormGrid,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { MODULE_LABELS, type ModuleKey } from "@/lib/entitlements";

export const Route = createFileRoute("/konkoureoffice/organisations")({
  component: AdminOrganizationsPage,
  head: () => ({
    meta: [
      { title: "Organisations — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUSES = ["trialing", "active", "canceled", "suspended", "expired"] as const;
const MODULE_KEYS = Object.keys(MODULE_LABELS) as ModuleKey[];

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "trialing") return "secondary" as const;
  return "outline" as const;
}

function AdminOrganizationsPage() {
  const qc = useQueryClient();
  const listFn = listAdminOrganizations;
  const detailFn = getAdminOrganization;
  const updateFn = updateAdminOrganization;
  const plansFn = listAdminPlans;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["admin-orgs", search, status],
    queryFn: () =>
      listFn({
        data: { search: search || undefined, status: status === "all" ? undefined : status, limit: 200 },
      }),
  });
  const plansQ = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });
  const detailQ = useQuery({
    queryKey: ["admin-org", editing],
    queryFn: () => detailFn({ data: { organizationId: editing! } }),
    enabled: !!editing,
  });

  const [form, setForm] = useState<{
    planId: string;
    statut: string;
    cycle: string;
    periodeFin: string;
    maxOverride: string;
    modules: string[] | null;
  } | null>(null);

  const detail = detailQ.data?.organization as any;
  useMemo(() => {
    if (detail && editing) {
      setForm({
        planId: detail.plan_id ?? "",
        statut: detail.statut_abo ?? "trialing",
        cycle: detail.cycle ?? "mensuel",
        periodeFin: detail.periode_fin ? String(detail.periode_fin).slice(0, 10) : "",
        maxOverride: detail.max_employes_override ? String(detail.max_employes_override) : "",
        modules: (detail.modules_override as string[] | null) ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !form) return;
      await updateFn({
        data: {
          organizationId: editing,
          planId: form.planId || null,
          statut_abo: form.statut as any,
          cycle: form.cycle as any,
          periode_fin: form.periodeFin ? new Date(form.periodeFin + "T23:59:59Z").toISOString() : null,
          max_employes_override: form.maxOverride ? Number(form.maxOverride) : null,
          modules_override: form.modules,
        },
      });
    },
    onSuccess: () => {
      toast.success("Organisation mise à jour");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["admin-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const rows: any[] = listQ.data ?? [];

  const exportCsv = () => {
    const header = ["Nom", "Offre", "Statut", "Cycle", "Échéance", "Employés", "Créée le"];
    const lines = rows.map((o) =>
      [o.name, o.plan_nom, o.statut_abo, o.cycle, formatDate(o.periode_fin), o.employees, formatDate(o.created_at)]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "organisations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisations"
        description="Offres, statuts d'abonnement et surcharges"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une organisation…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {listQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune organisation" hint="Ajustez la recherche ou les filtres." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={rows}
              getRowKey={(o) => String(o.id)}
              empty="Aucune organisation"
              columns={[
                {
                  key: "name",
                  header: "Organisation",
                  priority: "primary",
                  cell: (o) => <span className="break-words">{o.name}</span>,
                },
                { key: "plan", header: "Offre", cell: (o) => o.plan_nom },
                {
                  key: "status",
                  header: "Statut",
                  cell: (o) => (
                    <Badge variant={statusVariant(String(o.statut_abo))}>{o.statut_abo}</Badge>
                  ),
                },
                { key: "end", header: "Échéance", cell: (o) => formatDate(o.periode_fin) },
                {
                  key: "employees",
                  header: "Employés",
                  align: "right",
                  cell: (o) => `${o.employees}${o.max_employes ? ` / ${o.max_employes}` : ""}`,
                },
                { key: "created", header: "Créée le", cell: (o) => formatDate(o.created_at) },
                {
                  key: "actions",
                  header: "",
                  priority: "actions",
                  align: "right",
                  cell: (o) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(o.id)}
                      aria-label="Configurer"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.name ?? "Organisation"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {!form || detailQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <DialogFormGrid>
                  <div className="space-y-2">
                    <Label>Offre</Label>
                    <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une offre" />
                      </SelectTrigger>
                      <SelectContent>
                        {(plansQ.data ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                      <SelectTrigger>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Cycle</Label>
                    <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensuel">Mensuel</SelectItem>
                        <SelectItem value="annuel">Annuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periode">Échéance</Label>
                    <Input
                      id="periode"
                      type="date"
                      value={form.periodeFin}
                      onChange={(e) => setForm({ ...form, periodeFin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxemp">Plafond d'employés personnalisé</Label>
                    <Input
                      id="maxemp"
                      type="number"
                      min={1}
                      placeholder="Plafond de l'offre"
                      value={form.maxOverride}
                      onChange={(e) => setForm({ ...form, maxOverride: e.target.value })}
                    />
                  </div>
                </DialogFormGrid>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mods"
                      checked={form.modules !== null}
                      onCheckedChange={(c) => setForm({ ...form, modules: c ? [] : null })}
                    />
                    <Label htmlFor="mods">Modules personnalisés (sinon ceux de l'offre)</Label>
                  </div>
                  {form.modules !== null && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {MODULE_KEYS.map((m) => (
                        <label key={m} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Checkbox
                            checked={form.modules!.includes(m)}
                            onCheckedChange={(c) =>
                              setForm({
                                ...form,
                                modules: c
                                  ? [...form.modules!, m]
                                  : form.modules!.filter((x) => x !== m),
                              })
                            }
                          />
                          {MODULE_LABELS[m]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {detailQ.data && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {detailQ.data.employees.total} employé(s) · {detailQ.data.members.length} membre(s) ·{" "}
                    {detailQ.data.payments.length} paiement(s)
                  </p>
                )}

                <DialogActions>
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Annuler
                  </Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
                    Enregistrer
                  </Button>
                </DialogActions>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
