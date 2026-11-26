import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  isRootOnly,
  MODULES_OPEN_FOR_TESTING,
  platformSettingsQuery,
  updatePlatformSettings,
  type PlatformSetting,
} from "@/lib/api/platform";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/reglages")({
  component: AdminSettingsPage,
  head: () => ({
    meta: [
      { title: "Réglages — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

/** Settings the API accepts to write (its registry); the others are read-only. */
const LABELS: Record<string, string> = {
  [MODULES_OPEN_FOR_TESTING]: "Ouvrir tous les modules à toutes les organisations (test)",
};

const display = (value: unknown) =>
  value === null || value === undefined
    ? "—"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

function AdminSettingsPage() {
  const qc = useQueryClient();
  const { canWrite } = usePlatformAdmin();
  const settings = useQuery(platformSettingsQuery());

  const save = useMutation({
    mutationFn: (entry: { key: string; value: unknown }) => updatePlatformSettings([entry]),
    onSuccess: (rows) => {
      qc.setQueryData(platformSettingsQuery().queryKey, rows);
      toast.success("Réglage enregistré (effet sous une minute)");
    },
    onError: (e) =>
      toast.error(isRootOnly(e) ? "Action réservée aux administrateurs root." : apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Réglages globaux" description="Configuration de la plateforme" />

      {settings.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(settings.error)}</p>
      ) : settings.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : settings.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun réglage défini.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {settings.data.map((s) => (
              <SettingRow
                key={s.key}
                setting={s}
                editable={canWrite && s.key in LABELS && typeof s.value === "boolean"}
                saving={save.isPending}
                onChange={(value) => save.mutate({ key: s.key, value })}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SettingRow({
  setting,
  editable,
  saving,
  onChange,
}: {
  setting: PlatformSetting;
  editable: boolean;
  saving: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `setting-${setting.key}`;
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="font-medium">
          {LABELS[setting.key] ?? setting.key}
        </Label>
        <p className="text-xs text-muted-foreground">
          <code>{setting.key}</code>
          {setting.description ? ` · ${setting.description}` : ""} · modifié le{" "}
          {formatDateTime(setting.updatedAt)}
        </p>
      </div>
      {setting.isSecret ? (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Valeur masquée
        </span>
      ) : typeof setting.value === "boolean" ? (
        <Switch
          id={id}
          checked={setting.value}
          disabled={!editable || saving}
          onCheckedChange={(checked) => onChange(checked)}
        />
      ) : (
        <span className="break-all font-mono text-sm">{display(setting.value)}</span>
      )}
    </div>
  );
}
