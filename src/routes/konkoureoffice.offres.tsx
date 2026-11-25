import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import {
  createPlan,
  deletePlan,
  isRootOnly,
  platformKey,
  platformPlansQuery,
  updatePlan,
  type PlanInput,
  type PlatformPlan,
} from "@/lib/api/platform";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatCurrency } from "@/lib/currency";
import { MODULE_LABELS, type ModuleKey } from "@/lib/entitlements";

export const Route = createFileRoute("/konkoureoffice/offres")({
  component: AdminPlansPage,
  head: () => ({
    meta: [
      { title: "Offres & tarifs — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const MODULE_KEYS = Object.keys(MODULE_LABELS) as ModuleKey[];
const PLAN_CODE = /^[a-z][a-z0-9_-]{1,39}$/;

type FormState = {
  id?: string;
  code: string;
  name: string;
  priceGnf: string;
  /** Empty: 10 months. */
  priceYearlyGnf: string;
  maxEmployees: string;
  aiCreditsPerMonth: string;
  sortOrder: string;
  isPublic: boolean;
  modules: ModuleKey[];
  features: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  priceGnf: "0",
  priceYearlyGnf: "",
  maxEmployees: "10",
  aiCreditsPerMonth: "0",
  sortOrder: "0",
  isPublic: true,
  modules: [],
  features: "",
};

const featureList = (features: unknown): string[] =>
  Array.isArray(features) ? features.filter((f): f is string => typeof f === "string") : [];

function formFrom(p: PlatformPlan): FormState {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceGnf: String(p.priceGnf),
    priceYearlyGnf: p.explicitYearlyPriceGnf === null ? "" : String(p.explicitYearlyPriceGnf),
    maxEmployees: String(p.maxEmployees),
    aiCreditsPerMonth: String(p.aiCreditsPerMonth),
    sortOrder: String(p.sortOrder),
    isPublic: p.isPublic,
    modules: p.modules as ModuleKey[],
    features: featureList(p.features).join("\n"),
  };
}

function toInput(f: FormState): PlanInput {
  return {
    name: f.name.trim(),
    priceGnf: Number(f.priceGnf || 0),
    priceYearlyGnf: f.priceYearlyGnf.trim() ? Number(f.priceYearlyGnf) : null,
    maxEmployees: Number(f.maxEmployees || 0),
    aiCreditsPerMonth: Number(f.aiCreditsPerMonth || 0),
    sortOrder: Number(f.sortOrder || 0),
    isPublic: f.isPublic,
    modules: f.modules,
    features: f.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function planError(error: unknown) {
  if (isRootOnly(error)) return "Action réservée aux administrateurs root.";
  if (isApiError(error, "E_CONFLICT")) {
    const rule = error.details[0]?.rule;
    if (rule === "inUse")
      return "Cette offre est encore utilisée ou programmée par un abonnement : elle ne peut pas être supprimée.";
    return "Ce code d'offre existe déjà.";
  }
  return apiErrorMessage(error);
}

function AdminPlansPage() {
  const qc = useQueryClient();
  const { canWrite } = usePlatformAdmin();
  const plans = useQuery(platformPlansQuery());
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<PlatformPlan | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: [...platformKey, "plans"] });

  const save = useMutation({
    mutationFn: (f: FormState) =>
      f.id ? updatePlan(f.id, toInput(f)) : createPlan({ ...toInput(f), code: f.code.trim() }),
    onSuccess: async () => {
      toast.success("Offre enregistrée");
      setForm(null);
      await refresh();
    },
    onError: (e) => toast.error(planError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: async () => {
      toast.success("Offre supprimée");
      setToDelete(null);
      await refresh();
    },
    onError: (e) => {
      setToDelete(null);
      toast.error(planError(e));
    },
  });

  const codeOk = !!form && (!!form.id || PLAN_CODE.test(form.code.trim()));
  const canSave = !!form && codeOk && form.name.trim().length >= 2 && !save.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres & tarifs"
        description="Prix, quotas et modules inclus — modifiables sans toucher au code"
        actions={
          canWrite && (
            <Button onClick={() => setForm({ ...EMPTY })}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle offre
            </Button>
          )
        }
      />

      {plans.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(plans.error)}</p>
      ) : plans.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((p) => (
            <Card
              key={p.id}
              data-testid="platform-plan"
              className={p.deletedAt ? "opacity-60" : ""}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  {canWrite && !p.deletedAt && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Modifier ${p.name}`}
                        onClick={() => setForm(formFrom(p))}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer ${p.name}`}
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.deletedAt && <Badge variant="destructive">Supprimée</Badge>}
                  {!p.isPublic && <Badge variant="outline">Non publique</Badge>}
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(p.priceGnf)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">/ mois</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(p.priceYearlyGnf)} / an
                  {p.explicitYearlyPriceGnf === null ? " (10 mois)" : ""} · {p.maxEmployees}{" "}
                  employés · {p.aiCreditsPerMonth} crédits IA/mois
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.modules.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px]">
                      {MODULE_LABELS[m as ModuleKey] ?? m}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {form && (
              <>
                <DialogFormGrid>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={form.code}
                      disabled={!!form.id}
                      placeholder="ex. premium"
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                    {!codeOk && form.code && (
                      <p className="text-xs text-destructive">
                        Minuscules, chiffres, « - » et « _ », en commençant par une lettre.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      value={form.name}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prix">Prix mensuel (GNF)</Label>
                    <Input
                      id="prix"
                      type="number"
                      min={0}
                      value={form.priceGnf}
                      onChange={(e) => setForm({ ...form, priceGnf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prix-annuel">Prix annuel (GNF)</Label>
                    <Input
                      id="prix-annuel"
                      type="number"
                      min={0}
                      placeholder="Vide : 10 mois"
                      value={form.priceYearlyGnf}
                      onChange={(e) => setForm({ ...form, priceYearlyGnf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max">Plafond d'employés</Label>
                    <Input
                      id="max"
                      type="number"
                      min={1}
                      value={form.maxEmployees}
                      onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="credits">Crédits IA / mois</Label>
                    <Input
                      id="credits"
                      type="number"
                      min={0}
                      value={form.aiCreditsPerMonth}
                      onChange={(e) => setForm({ ...form, aiCreditsPerMonth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ordre">Ordre d'affichage</Label>
                    <Input
                      id="ordre"
                      type="number"
                      min={0}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-2">
                    <Checkbox
                      id="public"
                      checked={form.isPublic}
                      onCheckedChange={(c) => setForm({ ...form, isPublic: c === true })}
                    />
                    <Label htmlFor="public">Affichée sur la page publique des offres</Label>
                  </div>
                </DialogFormGrid>

                <div className="mt-4 space-y-2">
                  <Label>Modules inclus</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {MODULE_KEYS.map((m) => (
                      <label
                        key={m}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <Checkbox
                          checked={form.modules.includes(m)}
                          onCheckedChange={(c) =>
                            setForm({
                              ...form,
                              modules: c
                                ? [...form.modules, m]
                                : form.modules.filter((x) => x !== m),
                            })
                          }
                        />
                        {MODULE_LABELS[m]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="feat">Arguments commerciaux (une ligne par élément)</Label>
                  <Textarea
                    id="feat"
                    rows={5}
                    value={form.features}
                    onChange={(e) => setForm({ ...form, features: e.target.value })}
                  />
                </div>

                <DialogActions>
                  <Button variant="outline" onClick={() => setForm(null)}>
                    Annuler
                  </Button>
                  <Button onClick={() => save.mutate(form)} disabled={!canSave}>
                    Enregistrer
                  </Button>
                </DialogActions>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette offre ?"
        subtitle={toDelete?.name}
        description="Elle n'est plus proposée, mais reste visible ici. La suppression est refusée tant qu'un abonnement en cours l'utilise ou la programme."
        actionLabel="Supprimer"
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
