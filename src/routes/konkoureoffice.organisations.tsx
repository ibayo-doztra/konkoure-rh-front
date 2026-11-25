import { csvCell } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Settings2, Download } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import {
  isRootOnly,
  platformKey,
  platformOrganizationQuery,
  platformOrganizationsQuery,
  platformPlansQuery,
  reactivateOrganization,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
  suspendOrganization,
  updateOrganizationSubscription,
  type PlatformOrganization,
  type SubscriptionPatch,
} from "@/lib/api/platform";
import type { BillingCycle, SubscriptionStatus } from "@/lib/api/billing";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const MODULE_KEYS = Object.keys(MODULE_LABELS) as ModuleKey[];
const ALL = "all";

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "trialing") return "secondary" as const;
  if (status === "suspended" || status === "expired") return "destructive" as const;
  return "outline" as const;
}

const statusLabel = (status: string) =>
  SUBSCRIPTION_STATUS_LABELS[status as SubscriptionStatus] ?? status;

/** Message of a refused write: `support` cannot write, the rest comes from the API. */
function writeError(error: unknown) {
  if (isRootOnly(error)) return "Action réservée aux administrateurs root.";
  return apiErrorMessage(error);
}

function AdminOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [plan, setPlan] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);

  const list = useQuery(
    platformOrganizationsQuery(page, {
      q: search.trim() || undefined,
      status: status === ALL ? undefined : (status as SubscriptionStatus),
      plan: plan === ALL ? undefined : plan,
    }),
  );
  const plans = useQuery(platformPlansQuery());
  const rows = list.data?.data ?? [];
  const lastPage = list.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const exportCsv = () => {
    const header = ["Nom", "Offre", "Statut", "Cycle", "Échéance", "Employés", "Créée le"];
    const lines = rows.map((o) =>
      [
        o.name,
        o.subscription?.planName ?? "",
        o.subscription ? statusLabel(o.subscription.status) : "",
        o.subscription?.cycle ?? "",
        formatDate(o.subscription?.currentPeriodEnd ?? null),
        o.employees,
        formatDate(o.createdAt),
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom ou identifiant…"
              aria-label="Rechercher une organisation"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label="Statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SUBSCRIPTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={plan}
            onValueChange={(value) => {
              setPlan(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label="Offre">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les offres</SelectItem>
              {(plans.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.code}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {list.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(list.error)}</p>
      ) : list.isPending ? (
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
              getRowKey={(o) => o.id}
              empty="Aucune organisation"
              columns={[
                {
                  key: "name",
                  header: "Organisation",
                  priority: "primary",
                  cell: (o) => <span className="break-words">{o.name}</span>,
                },
                { key: "plan", header: "Offre", cell: (o) => o.subscription?.planName ?? "—" },
                {
                  key: "status",
                  header: "Statut",
                  cell: (o) =>
                    o.subscription ? (
                      <Badge variant={statusVariant(o.subscription.status)}>
                        {statusLabel(o.subscription.status)}
                      </Badge>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "end",
                  header: "Échéance",
                  cell: (o) =>
                    formatDate(
                      o.subscription?.status === "trialing"
                        ? o.subscription.trialEndsAt
                        : (o.subscription?.currentPeriodEnd ?? null),
                    ),
                },
                { key: "employees", header: "Employés", align: "right", cell: (o) => o.employees },
                { key: "created", header: "Créée le", cell: (o) => formatDate(o.createdAt) },
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
                      aria-label={`Gérer ${o.name}`}
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

      <ListPager page={page} lastPage={lastPage} onChange={setPage} />

      <OrganizationDialog id={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

interface FormState {
  planId: string;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  periodEnd: string;
  trialEnd: string;
  maxOverride: string;
  modules: ModuleKey[] | null;
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const endOfDay = (date: string) => new Date(`${date}T23:59:59Z`).toISOString();

function formFrom(o: PlatformOrganization): FormState | null {
  const s = o.subscription;
  if (!s) return null;
  return {
    planId: s.plan?.id ?? "",
    status: s.storedStatus,
    cycle: s.cycle,
    periodEnd: day(s.currentPeriodEnd),
    trialEnd: day(s.trialEndsAt),
    maxOverride: s.maxEmployeesOverride ? String(s.maxEmployeesOverride) : "",
    modules: s.modulesOverride,
  };
}

function OrganizationDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { canWrite } = usePlatformAdmin();
  const detail = useQuery({ ...platformOrganizationQuery(id ?? ""), enabled: !!id });
  const plans = useQuery(platformPlansQuery());
  const [form, setForm] = useState<FormState | null>(null);
  const [confirm, setConfirm] = useState<"suspend" | "reactivate" | null>(null);
  const org = detail.data;

  useEffect(() => {
    setForm(org ? formFrom(org) : null);
  }, [org]);

  const applied = async (result: PlatformOrganization, message: string) => {
    qc.setQueryData(platformOrganizationQuery(result.id).queryKey, result);
    await qc.invalidateQueries({ queryKey: [...platformKey, "organizations"] });
    await qc.invalidateQueries({ queryKey: [...platformKey, "dashboard"] });
    toast.success(message);
  };

  const save = useMutation({
    mutationFn: () => {
      const patch: SubscriptionPatch = {
        ...(form!.planId ? { planId: form!.planId } : {}),
        status: form!.status,
        cycle: form!.cycle,
        ...(form!.periodEnd ? { currentPeriodEnd: endOfDay(form!.periodEnd) } : {}),
        trialEndsAt: form!.trialEnd ? endOfDay(form!.trialEnd) : null,
        maxEmployeesOverride: form!.maxOverride ? Number(form!.maxOverride) : null,
        modulesOverride: form!.modules,
      };
      return updateOrganizationSubscription(id!, patch);
    },
    onSuccess: async (result) => {
      await applied(result, "Abonnement mis à jour");
      onClose();
    },
    onError: (e) => toast.error(writeError(e)),
  });

  const toggle = useMutation({
    mutationFn: (action: "suspend" | "reactivate") =>
      action === "suspend" ? suspendOrganization(id!) : reactivateOrganization(id!),
    onSuccess: async (result, action) => {
      setConfirm(null);
      await applied(
        result,
        action === "suspend" ? "Organisation suspendue" : "Organisation réactivée",
      );
    },
    onError: (e) => {
      setConfirm(null);
      toast.error(
        isApiError(e, "E_CONFLICT")
          ? "Le statut actuel de l'abonnement ne permet pas cette action."
          : writeError(e),
      );
    },
  });

  const suspended = org?.subscription?.storedStatus === "suspended";

  return (
    <>
      <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{org?.name ?? "Organisation"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {detail.isError ? (
              <p className="text-sm text-destructive">{apiErrorMessage(detail.error)}</p>
            ) : !org ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-5">
                <dl
                  className="grid gap-3 text-sm sm:grid-cols-3"
                  data-testid="organization-summary"
                >
                  <div>
                    <dt className="text-xs text-muted-foreground">Statut</dt>
                    <dd>
                      {org.subscription ? (
                        <Badge variant={statusVariant(org.subscription.status)}>
                          {statusLabel(org.subscription.status)}
                        </Badge>
                      ) : (
                        "Sans abonnement"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Employés / membres</dt>
                    <dd className="font-medium">
                      {org.counts.employees} / {org.counts.members}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Créée le</dt>
                    <dd className="font-medium">{formatDate(org.createdAt)}</dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-muted-foreground">Propriétaires</dt>
                    <dd className="font-medium break-words">
                      {org.owners.length
                        ? org.owners.map((o) => o.fullName ?? o.email).join(", ")
                        : "—"}
                    </dd>
                  </div>
                  {org.usage && (
                    <div className="sm:col-span-3">
                      <dt className="text-xs text-muted-foreground">
                        Utilisation ({org.usage.period})
                      </dt>
                      <dd className="font-medium">
                        {org.usage.employees.used}
                        {org.usage.employees.limit !== null
                          ? ` / ${org.usage.employees.limit}`
                          : ""}{" "}
                        employés · {org.usage.aiCredits.used}
                        {org.usage.aiCredits.limit !== null
                          ? ` / ${org.usage.aiCredits.limit}`
                          : ""}{" "}
                        crédits IA
                      </dd>
                    </div>
                  )}
                </dl>

                {form && (
                  <fieldset disabled={!canWrite} className="space-y-4">
                    <DialogFormGrid>
                      <div className="space-y-2">
                        <Label htmlFor="org-plan">Offre</Label>
                        <Select
                          value={form.planId}
                          onValueChange={(v) => setForm({ ...form, planId: v })}
                        >
                          <SelectTrigger id="org-plan">
                            <SelectValue placeholder="Choisir une offre" />
                          </SelectTrigger>
                          <SelectContent>
                            {(plans.data ?? [])
                              .filter((p) => !p.deletedAt || p.id === form.planId)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-status">Statut enregistré</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) =>
                            setForm({ ...form, status: v as SubscriptionStatus })
                          }
                        >
                          <SelectTrigger id="org-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBSCRIPTION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {SUBSCRIPTION_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-cycle">Cycle</Label>
                        <Select
                          value={form.cycle}
                          onValueChange={(v) => setForm({ ...form, cycle: v as BillingCycle })}
                        >
                          <SelectTrigger id="org-cycle">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensuel</SelectItem>
                            <SelectItem value="yearly">Annuel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-period">Échéance de la période</Label>
                        <Input
                          id="org-period"
                          type="date"
                          value={form.periodEnd}
                          onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-trial">Fin de l'essai</Label>
                        <Input
                          id="org-trial"
                          type="date"
                          value={form.trialEnd}
                          onChange={(e) => setForm({ ...form, trialEnd: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-max">Plafond d'employés personnalisé</Label>
                        <Input
                          id="org-max"
                          type="number"
                          min={1}
                          placeholder="Plafond de l'offre"
                          value={form.maxOverride}
                          onChange={(e) => setForm({ ...form, maxOverride: e.target.value })}
                        />
                      </div>
                    </DialogFormGrid>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="org-modules"
                          checked={form.modules !== null}
                          onCheckedChange={(c) => setForm({ ...form, modules: c ? [] : null })}
                        />
                        <Label htmlFor="org-modules">
                          Modules personnalisés (sinon ceux de l'offre)
                        </Label>
                      </div>
                      {form.modules !== null && (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {MODULE_KEYS.map((m) => (
                            <label
                              key={m}
                              className="flex items-center gap-2 rounded-md border p-2 text-sm"
                            >
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
                  </fieldset>
                )}

                {!canWrite && (
                  <p className="text-xs text-muted-foreground">
                    Lecture seule : les modifications sont réservées aux administrateurs root.
                  </p>
                )}

                <DialogActions>
                  {canWrite && org.subscription && (
                    <Button
                      variant={suspended ? "outline" : "destructive"}
                      onClick={() => setConfirm(suspended ? "reactivate" : "suspend")}
                      disabled={toggle.isPending}
                    >
                      {suspended ? "Réactiver" : "Suspendre"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={onClose}>
                    Fermer
                  </Button>
                  {canWrite && form && (
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      Enregistrer
                    </Button>
                  )}
                </DialogActions>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "suspend"
            ? "Suspendre cette organisation ?"
            : "Réactiver cette organisation ?"
        }
        subtitle={org?.name}
        description={
          confirm === "suspend"
            ? "Ses modules sont coupés et les données RH passent en lecture seule jusqu'à la réactivation."
            : "Le statut est recalculé à partir de l'échéance de l'abonnement."
        }
        actionLabel={confirm === "suspend" ? "Suspendre" : "Réactiver"}
        actionVariant={confirm === "suspend" ? "destructive" : "default"}
        loading={toggle.isPending}
        onConfirm={() => confirm && toggle.mutate(confirm)}
      />
    </>
  );
}
