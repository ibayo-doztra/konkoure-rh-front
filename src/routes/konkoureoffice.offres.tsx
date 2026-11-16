import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAdminPlan, listAdminPlans, upsertAdminPlan } from "@/lib/api/legacy-functions";
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

type FormState = {
  id?: string;
  code: string;
  nom: string;
  prix_gnf: string;
  max_employes: string;
  credits_ia_mois: string;
  sort_order: string;
  modules: string[];
  features: string;
};

const EMPTY: FormState = {
  code: "",
  nom: "",
  prix_gnf: "0",
  max_employes: "10",
  credits_ia_mois: "0",
  sort_order: "0",
  modules: [],
  features: "",
};

function AdminPlansPage() {
  const qc = useQueryClient();
  const listFn = listAdminPlans;
  const upsertFn = upsertAdminPlan;
  const deleteFn = deleteAdminPlan;

  const { data, isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => listFn() });
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; nom: string } | null>(null);

  const save = useMutation({
    mutationFn: async (f: FormState) =>
      upsertFn({
        data: {
          ...(f.id ? { id: f.id } : {}),
          code: f.code.trim(),
          nom: f.nom.trim(),
          prix_gnf: Number(f.prix_gnf || 0),
          max_employes: Number(f.max_employes || 0),
          credits_ia_mois: Number(f.credits_ia_mois || 0),
          sort_order: Number(f.sort_order || 0),
          modules: f.modules,
          features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
        } as any,
      }),
    onSuccess: () => {
      toast.success("Offre enregistrée");
      setForm(null);
      void qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Offre supprimée");
      setToDelete(null);
      void qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres & tarifs"
        description="Prix, quotas et modules inclus — modifiables sans toucher au code"
        actions={
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle offre
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((p: any) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{p.nom}</h2>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Modifier"
                      onClick={() =>
                        setForm({
                          id: p.id,
                          code: p.code,
                          nom: p.nom,
                          prix_gnf: String(p.prix_gnf ?? 0),
                          max_employes: String(p.max_employes ?? 0),
                          credits_ia_mois: String(p.credits_ia_mois ?? 0),
                          sort_order: String(p.sort_order ?? 0),
                          modules: p.modules ?? [],
                          features: (p.featureList ?? []).join("\n"),
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer"
                      onClick={() => setToDelete({ id: p.id, nom: p.nom })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-lg font-semibold">{formatCurrency(Number(p.prix_gnf))}</p>
                <p className="text-sm text-muted-foreground">
                  {p.max_employes} employés · {p.credits_ia_mois} crédits IA/mois · {p.organizations} org.
                </p>
                <div className="flex flex-wrap gap-1">
                  {(p.modules ?? []).map((m: string) => (
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
                    <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input id="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prix">Prix mensuel (GNF)</Label>
                    <Input
                      id="prix"
                      type="number"
                      min={0}
                      value={form.prix_gnf}
                      onChange={(e) => setForm({ ...form, prix_gnf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max">Plafond d'employés</Label>
                    <Input
                      id="max"
                      type="number"
                      min={1}
                      value={form.max_employes}
                      onChange={(e) => setForm({ ...form, max_employes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="credits">Crédits IA / mois</Label>
                    <Input
                      id="credits"
                      type="number"
                      min={0}
                      value={form.credits_ia_mois}
                      onChange={(e) => setForm({ ...form, credits_ia_mois: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ordre">Ordre d'affichage</Label>
                    <Input
                      id="ordre"
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    />
                  </div>
                </DialogFormGrid>

                <div className="mt-4 space-y-2">
                  <Label>Modules inclus</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {MODULE_KEYS.map((m) => (
                      <label key={m} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <Checkbox
                          checked={form.modules.includes(m)}
                          onCheckedChange={(c) =>
                            setForm({
                              ...form,
                              modules: c ? [...form.modules, m] : form.modules.filter((x) => x !== m),
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
                  <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
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
        subtitle={toDelete?.nom}
        description="Cette action est définitive. Elle est refusée si des organisations utilisent encore cette offre."
        actionLabel="Supprimer"
        actionVariant="destructive"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
