import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/api/legacy-functions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/konkoureoffice/reglages")({
  component: AdminSettingsPage,
  head: () => ({
    meta: [
      { title: "Réglages globaux — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const getFn = getPlatformSettings;
  const saveFn = updatePlatformSettings;

  const { data, isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: () => getFn() });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const s of data.settings as any[]) {
      next[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value ?? "");
    }
    setValues(next);
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          entries: Object.entries(values).map(([key, value]) => {
            let parsed: unknown = value;
            try {
              parsed = JSON.parse(value);
            } catch {
              parsed = value;
            }
            return { key, value: parsed };
          }),
        } as any,
      }),
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Réglages globaux" description="Configuration de la plateforme" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réglages globaux"
        description="Configuration de la plateforme, sans modification du code"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Enregistrer
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">Paramètres</h2>
          {(data.settings as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun paramètre défini.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(data.settings as any[]).map((s) => (
              <div key={s.key} className="space-y-2">
                <Label htmlFor={s.key}>{s.key}</Label>
                <Input
                  id={s.key}
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                />
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Clés et intégrations</h2>
          <p className="text-sm text-muted-foreground">
            Les valeurs ne sont jamais affichées : seul l'état de configuration est visible.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.secrets.map((s: any) => (
              <div key={s.name} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                {s.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
